import type { Quiz, SharedQuiz } from "@testownik/core/quiz/types";
import type { Group, User } from "@testownik/core/user/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Fragment, useRef, useState } from "react";
import { findNodeHandle, Platform, Share, View } from "react-native";
import Overflow from "../src/components/Overflow";
import { Collection, CollectionDivider } from "../src/components/Collection";
import ShareContent from "../src/components/share/ShareContent";
import { haptics } from "../src/lib/haptics";
import CollectionRow from "../src/components/native/CollectionRow";
import ValueMenu from "../src/components/native/ValueMenu";
import ToggleRow from "../src/components/ToggleRow";
import SettingsGroup, { SectionTitle } from "../src/components/SettingsGroup";
import {
  Button,
  EmptyState,
  ErrorScreen,
  ErrorState,
  Field,
  Heading,
  Label,
  Loading,
  Screen,
} from "../src/components/ui";
import { WEB_URL, listOf } from "../src/lib/api";
import { notify, useConfirm } from "../src/lib/alerts";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import {
  commitSharingAck,
  confirmSharingGrant,
  sharingTargetKey,
  sharingRead,
  sharingQuizAck,
} from "../src/lib/sharing-ack";
import { useSharingAction } from "../src/lib/use-sharing-action";
import { UserFacingError, userError } from "../src/lib/user-error";

export default function Sharing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { t } = useLocale();
  if (!user) return null;
  if (typeof id !== "string" || !id.trim())
    return (
      <EmptyState
        symbol="books.vertical"
        ionicon="library-outline"
        title={t("Wybierz quiz", "Choose a Quiz")}
        description={t(
          "Otwórz quiz z biblioteki, aby zarządzać dostępem.",
          "Open a quiz from the library to manage access.",
        )}
        actions={[
          {
            label: t("Przeglądaj bibliotekę", "Browse Library"),
            onPress: () => router.navigate("/library"),
          },
        ]}
      />
    );
  return (
    <SharingForm key={`${user?.id}:${id}`} id={id} userId={user?.id ?? ""} />
  );
}
function SharingForm({ id, userId }: { id: string; userId: string }) {
  const { client, session, busy, failure, mutate, heldTargets } =
    useSharingAction(id, userId);
  const { t } = useLocale(),
    confirm = useConfirm(),
    cache = useQueryClient();
  const [search, setSearch] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [invite, setInvite] = useState(false),
    [edit, setEdit] = useState(false);
  const anchor = useRef<View>(null);
  const quiz = useQuery({
    queryKey: ["sharing-quiz", id, userId],
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<Quiz>(`quizzes/${encodeURIComponent(id)}/`, { signal }),
  });
  const shares = useQuery({
    queryKey: ["shares", id, userId],
    networkMode: "always",
    queryFn: async ({ signal }) =>
      sharingRead(
        await client.request<unknown>(
          `shared-quizzes/?quiz=${encodeURIComponent(id)}`,
          { signal },
        ),
      ),
    enabled: !!quiz.data?.can_edit,
  });
  const groups = useQuery({
    queryKey: ["groups", userId],
    networkMode: "always",
    queryFn: async ({ signal }) =>
      listOf(await client.request<Group[]>("study-groups/", { signal })),
    enabled: !!quiz.data?.can_edit && invite,
  });
  const users = useQuery({
    queryKey: ["share-search", userId, submitted],
    networkMode: "always",
    queryFn: ({ signal }) =>
      client
        .request<User[]>(`users/?search=${encodeURIComponent(submitted)}`, {
          signal,
        })
        .then(listOf<User>),
    enabled:
      invite &&
      !!submitted &&
      submitted === search.trim() &&
      quiz.data?.visibility !== 0,
  });
  const labels = [
    t("Prywatny", "Private"),
    t("Udostępniony wybranym osobom", "Selected People"),
    t("Dostępny przez link", "Anyone with the Link"),
    t("Publiczny", "Public"),
  ];
  const explanations = [
    t(
      "Tylko właściciel ma dostęp. Istniejące zaproszenia są nieaktywne.",
      "Only the owner has access. Existing invitations are inactive.",
    ),
    t(
      "Dostęp mają tylko osoby i grupy wymienione poniżej.",
      "Only the people and groups listed below have access.",
    ),
    t(
      "Każdy, kto otrzyma link, może otworzyć quiz.",
      "Anyone who receives the link can open this quiz.",
    ),
    t(
      "Quiz jest widoczny w wyszukiwaniu i dostępny dla innych użytkowników.",
      "This quiz appears in search and is available to other users.",
    ),
  ];
  async function updateQuiz(patch: Partial<Quiz>) {
    const value = await client.patch<Quiz>(
      `quizzes/${encodeURIComponent(id)}/`,
      patch,
    );
    await commitSharingAck<Quiz>(
      cache,
      ["sharing-quiz", id, userId],
      session,
      (previous) => sharingQuizAck(previous, value),
    );
    if (session.aborted) return;
    void Promise.all([
      cache.invalidateQueries({ queryKey: ["quiz", id] }),
      cache.invalidateQueries({ queryKey: ["library"] }),
    ]);
  }
  function visibility(value: number) {
    confirm(
      t("Zmienić widoczność?", "Change Visibility?"),
      explanations[value],
      () =>
        mutate(() =>
          updateQuiz({
            visibility: value,
            ...(value < 2 ? { allow_anonymous: false } : {}),
          }),
        ),
      { action: t("Zmień", "Change"), destructive: false },
    );
  }
  async function grant(
    target: { user_id: string } | { study_group_id: string },
  ) {
    await mutate(async () => {
      await confirmSharingGrant(cache, id, userId, session, target, () =>
        client.post("shared-quizzes/", {
          quiz_id: id,
          ...target,
          allow_edit: edit,
        }),
      );
    });
  }
  async function setRole(share: SharedQuiz, allow_edit: boolean) {
    const ack = await client.patch<Partial<SharedQuiz>>(
      `shared-quizzes/${encodeURIComponent(share.id)}/`,
      { allow_edit },
    );
    await commitSharingAck<SharedQuiz[]>(
      cache,
      ["shares", id, userId],
      session,
      (previous) =>
        previous?.map((item) =>
          item.id === share.id &&
          ack?.id === share.id &&
          typeof ack.allow_edit === "boolean"
            ? { ...item, allow_edit: ack.allow_edit }
            : item,
        ),
    );
    if (!session.aborted) haptics.selection();
  }
  async function removeShare(share: SharedQuiz) {
    await client.delete(`shared-quizzes/${encodeURIComponent(share.id)}/`);
    await commitSharingAck<SharedQuiz[]>(
      cache,
      ["shares", id, userId],
      session,
      (previous) => previous?.filter((item) => item.id !== share.id),
    );
  }
  const failureTitle =
    failure instanceof UserFacingError && failure.code === "sharingUnconfirmed"
      ? t("Nie potwierdzono dostępu", "Access Not Confirmed")
      : t("Nie zapisano zmiany", "Change Not Saved");
  if (quiz.isPending) return <Loading />;
  if (!quiz.data)
    return <ErrorScreen error={quiz.error} retry={() => void quiz.refetch()} />;
  const value = quiz.data;
  const showResults = !!submitted && submitted === search.trim();
  const foundUsers = (showResults ? (users.data ?? []) : []).filter(
    (u) => u.id !== userId,
  );
  const foundGroups = showResults
    ? (groups.data?.filter((g) =>
        g.name.toLocaleLowerCase().includes(submitted.toLocaleLowerCase()),
      ) ?? [])
    : [];
  // Stack.Toolbar drops SF-symbol and text-only items on Android; use the JS controls.
  const native = Platform.OS === "ios";
  const shareLink = async () => {
    const url = `${WEB_URL}/quiz/${encodeURIComponent(id)}`;
    try {
      if (Platform.OS === "web" && !navigator.share) {
        await navigator.clipboard.writeText(url);
        if (!session.aborted) notify(t("Link skopiowany", "Link Copied"), url);
        return;
      }
      await Share.share(
        Platform.OS === "ios" ? { url } : { message: url, title: value.title },
        {
          subject: value.title,
          ...(Platform.OS === "ios" && anchor.current
            ? { anchor: findNodeHandle(anchor.current) ?? undefined }
            : {}),
        },
      );
    } catch (error) {
      if (
        session.aborted ||
        (error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError")
      )
        return;
      notify(
        t("Nie udostępniono linku", "Couldn’t Share Link"),
        userError(error, t),
      );
    }
  };
  if (Platform.OS === "ios")
    return (
      <ShareContent
        quiz={value}
        shares={shares.data}
        sharesLoading={!!value.can_edit && shares.isPending}
        sharesError={shares.error}
        quizError={quiz.error}
        retryQuiz={() => void quiz.refetch()}
        failureTitle={failureTitle}
        retryShares={() => void shares.refetch()}
        busy={busy}
        failure={failure}
        labels={labels}
        explanations={explanations}
        linkNote={
          value.visibility === 0
            ? t(
                "Ten quiz jest prywatny. Zmień widoczność, aby inni mogli otworzyć link.",
                "This quiz is private. Change visibility so others can open the link.",
              )
            : value.visibility === 1
              ? t(
                  "Link zadziała tylko dla zaproszonych osób i grup.",
                  "The link works only for invited people and groups.",
                )
              : value.allow_anonymous
                ? t(
                    "Link można otworzyć bez logowania.",
                    "Anyone can open the link without signing in.",
                  )
                : t(
                    "Otwarcie linku wymaga zalogowania do Testownika.",
                    "Opening the link requires signing in to Testownik.",
                  )
        }
        setVisibility={visibility}
        setAnonymousAccess={(allow_anonymous) =>
          void mutate(() => updateQuiz({ allow_anonymous }))
        }
        setHideAuthor={(is_anonymous) =>
          void mutate(() => updateQuiz({ is_anonymous }))
        }
        setRole={(share, allow_edit) => {
          if (share.allow_edit === allow_edit) return;
          void mutate(() => setRole(share, allow_edit));
        }}
        remove={(share) =>
          confirm(
            t("Odebrać dostęp?", "Remove Access?"),
            t(
              `${share.user?.full_name ?? share.group?.name ?? ""} straci dostęp do tego quizu.`,
              `${share.user?.full_name ?? share.group?.name ?? ""} will lose access to this quiz.`,
            ),
            () => mutate(() => removeShare(share)),
            { action: t("Odbierz dostęp", "Remove") },
          )
        }
        invite={() =>
          router.push({ pathname: "/share-invite", params: { id } })
        }
        shareLink={() => void shareLink()}
      />
    );
  return (
    <Screen>
      <Heading small>{value.title}</Heading>
      {native ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="square.and.arrow.up"
            onPress={() => void shareLink()}
          >
            {t("Wyślij link", "Share Link")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <View ref={anchor} collapsable={false}>
          <Button onPress={shareLink}>{t("Wyślij link", "Share Link")}</Button>
        </View>
      )}
      <Label muted>
        {value.visibility === 0
          ? t(
              "Ten quiz jest prywatny. Zmień widoczność, aby inni mogli otworzyć link.",
              "This quiz is private. Change visibility so others can open the link.",
            )
          : value.visibility === 1
            ? t(
                "Link zadziała tylko dla zaproszonych osób i grup.",
                "The link works only for invited people and groups.",
              )
            : value.allow_anonymous
              ? t(
                  "Link można otworzyć bez logowania.",
                  "Anyone can open the link without signing in.",
                )
              : t(
                  "Otwarcie linku wymaga zalogowania do Testownika.",
                  "Opening the link requires signing in to Testownik.",
                )}
      </Label>
      {value.can_edit && (
        <>
          <SectionTitle>{t("Widoczność", "Visibility")}</SectionTitle>
          <SettingsGroup>
            <ValueMenu
              label={t("Zmień widoczność", "Change Visibility")}
              value={String(value.visibility)}
              disabled={busy}
              options={labels.map((label, index) => ({
                value: String(index),
                label,
              }))}
              onChange={(selected) => {
                if (Number(selected) !== value.visibility)
                  visibility(Number(selected));
              }}
            />
            {value.visibility >= 2 && (
              <ToggleRow
                label={t(
                  "Dostęp bez logowania",
                  "Allow Access Without Signing In",
                )}
                value={value.allow_anonymous}
                disabled={busy}
                onValueChange={(allow_anonymous) =>
                  void mutate(() => updateQuiz({ allow_anonymous }))
                }
              />
            )}
            <ToggleRow
              label={t("Ukryj autora quizu", "Hide Quiz Author")}
              value={value.is_anonymous}
              disabled={busy}
              onValueChange={(is_anonymous) =>
                void mutate(() => updateQuiz({ is_anonymous }))
              }
            />
          </SettingsGroup>
          <Label muted>{explanations[value.visibility]}</Label>
          {quiz.error ? (
            <ErrorState error={quiz.error} retry={() => void quiz.refetch()} />
          ) : null}
          {failure ? <ErrorState title={failureTitle} error={failure} /> : null}
          <SectionTitle>
            {t("Osoby i grupy z dostępem", "People and Groups with Access")}
          </SectionTitle>
          <Collection>
            <CollectionRow
              title={
                invite
                  ? t("Zamknij zapraszanie", "Close Invitations")
                  : t("Dodaj osoby lub grupy", "Add People or Groups")
              }
              symbol={invite ? "xmark.circle" : "person.badge.plus"}
              ionicon={invite ? "close-circle-outline" : "person-add-outline"}
              disclosure={false}
              onPress={() => setInvite((open) => !open)}
            />
          </Collection>
          {invite &&
            (value.visibility === 0 ? (
              <SettingsGroup>
                <Label>
                  {t(
                    "Aby zaproszone osoby mogły otworzyć quiz, włącz dostęp dla wybranych osób.",
                    "Enable access for selected people before inviting them to this quiz.",
                  )}
                </Label>
                <Button kind="secondary" onPress={() => visibility(1)}>
                  {t(
                    "Udostępnij wybranym osobom",
                    "Share with Selected People",
                  )}
                </Button>
              </SettingsGroup>
            ) : (
              <SettingsGroup>
                <Field
                  label={t("Znajdź osobę lub grupę", "Find a person or group")}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  onSubmitEditing={() => setSubmitted(search.trim())}
                />
                <Button
                  kind="secondary"
                  disabled={!search.trim() || busy}
                  onPress={() => {
                    if (submitted === search.trim()) void users.refetch();
                    else setSubmitted(search.trim());
                  }}
                >
                  {t("Szukaj", "Search")}
                </Button>
                <ToggleRow
                  label={t("Zezwól na edycję", "Allow Editing")}
                  detail={t(
                    "Nowe osoby domyślnie mogą tylko się uczyć.",
                    "New people can study by default.",
                  )}
                  value={edit}
                  onValueChange={setEdit}
                  disabled={busy}
                />
                {showResults && users.isFetching ? (
                  <Label muted>{t("Szukam…", "Searching…")}</Label>
                ) : null}
                {showResults && users.error ? (
                  <ErrorState
                    error={users.error}
                    retry={() => void users.refetch()}
                  />
                ) : null}
                {groups.error ? (
                  <ErrorState
                    error={groups.error}
                    retry={() => void groups.refetch()}
                  />
                ) : null}
                {showResults &&
                !users.isPending &&
                !users.error &&
                !groups.isPending &&
                !groups.error &&
                !foundUsers.length &&
                !foundGroups.length ? (
                  <Label muted>
                    {t(
                      "Nie znaleziono osób ani grup. Spróbuj wpisać nazwisko lub numer indeksu.",
                      "No people or groups found. Try a surname or student number.",
                    )}
                  </Label>
                ) : null}
                {foundUsers.length || foundGroups.length ? (
                  <Collection>
                    {[
                      ...foundUsers.map((u) => ({
                        id: u.id,
                        name: u.full_name,
                        detail: u.student_number,
                        group: false,
                        added: shares.data?.some((s) => s.user?.id === u.id),
                        held: heldTargets.includes(
                          sharingTargetKey({ user_id: u.id }),
                        ),
                        grant: () => grant({ user_id: u.id }),
                      })),
                      ...foundGroups.map((g) => ({
                        id: g.id,
                        name: g.name,
                        detail: t("Grupa", "Group"),
                        group: true,
                        added: shares.data?.some((s) => s.group?.id === g.id),
                        held: heldTargets.includes(
                          sharingTargetKey({ study_group_id: g.id }),
                        ),
                        grant: () => grant({ study_group_id: g.id }),
                      })),
                    ].map((entry, index) => (
                      <Fragment key={entry.id}>
                        {index ? <CollectionDivider /> : null}
                        {/* A list of people, each row adds that person. */}
                        <CollectionRow
                          title={entry.name}
                          detail={
                            entry.added
                              ? t("Ma dostęp", "Has access")
                              : entry.held
                                ? t("Sprawdzam dostęp…", "Checking access…")
                                : entry.detail || undefined
                          }
                          ionicon={
                            entry.added
                              ? "checkmark-circle"
                              : entry.group
                                ? "people-outline"
                                : "person-add-outline"
                          }
                          disclosure={false}
                          accessibilityLabel={
                            entry.added
                              ? t(
                                  `${entry.name} — dodano`,
                                  `${entry.name} — added`,
                                )
                              : entry.group
                                ? t(
                                    `Dodaj grupę: ${entry.name}`,
                                    `Add group: ${entry.name}`,
                                  )
                                : t(
                                    `Dodaj: ${entry.name}`,
                                    `Add: ${entry.name}`,
                                  )
                          }
                          disabled={
                            busy || !!entry.added || entry.held || !shares.data
                          }
                          onPress={entry.grant}
                        />
                      </Fragment>
                    ))}
                  </Collection>
                ) : null}
              </SettingsGroup>
            ))}
          {heldTargets.length > 0 && !shares.error ? (
            <Button kind="secondary" onPress={() => void shares.refetch()}>
              {t("Sprawdź dostęp", "Check Access")}
            </Button>
          ) : null}
          {shares.error ? (
            <ErrorState
              error={shares.error}
              retry={() => void shares.refetch()}
            />
          ) : null}
          {shares.isPending ? (
            <Label muted>{t("Wczytuję uprawnienia…", "Loading access…")}</Label>
          ) : (
            <SettingsGroup>
              {!shares.data?.length && (
                <View style={{ paddingVertical: 12 }}>
                  <Label muted>
                    {t(
                      "Nie dodano jeszcze żadnych osób ani grup.",
                      "No people or groups have been added yet.",
                    )}
                  </Label>
                </View>
              )}
              {shares.data?.map((share) => (
                <View
                  key={share.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Label>{share.user?.full_name ?? share.group?.name}</Label>
                    <Label muted>
                      {share.allow_edit
                        ? t("Może edytować", "Can edit")
                        : t("Może się uczyć", "Can study")}
                    </Label>
                  </View>
                  <Overflow
                    label={t(
                      `Opcje dostępu: ${share.user?.full_name ?? share.group?.name}`,
                      `Access options: ${share.user?.full_name ?? share.group?.name}`,
                    )}
                    items={[
                      {
                        disabled: busy,
                        title: share.allow_edit
                          ? t("Zmień na tylko naukę", "Change to Study Only")
                          : t("Zezwól na edycję", "Allow Editing"),
                        onPress: () =>
                          mutate(() => setRole(share, !share.allow_edit)),
                      },
                      {
                        disabled: busy,
                        title: t("Odbierz dostęp", "Remove Access"),
                        destructive: true,
                        onPress: () =>
                          confirm(
                            t("Odebrać dostęp?", "Remove Access?"),
                            t(
                              "Wybrana osoba lub grupa straci dostęp wynikający z tego udostępnienia.",
                              "This person or group will lose access granted by this invitation.",
                            ),
                            () => mutate(() => removeShare(share)),
                            { action: t("Odbierz dostęp", "Remove") },
                          ),
                      },
                    ]}
                  />
                </View>
              ))}
            </SettingsGroup>
          )}
        </>
      )}
    </Screen>
  );
}
