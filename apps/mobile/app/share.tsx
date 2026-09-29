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
  ErrorScreen,
  ErrorState,
  Field,
  Heading,
  Label,
  Loading,
  Screen,
} from "../src/components/ui";
import { WEB_URL, api, listOf } from "../src/lib/api";
import { notify, useConfirm } from "../src/lib/alerts";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { userError } from "../src/lib/user-error";

export default function Sharing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  return (
    <SharingForm key={`${user?.id}:${id}`} id={id} userId={user?.id ?? ""} />
  );
}
function SharingForm({ id, userId }: { id: string; userId: string }) {
  const { t } = useLocale(),
    confirm = useConfirm(),
    cache = useQueryClient();
  const [search, setSearch] = useState(""),
    [submitted, setSubmitted] = useState(""),
    [invite, setInvite] = useState(false),
    [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<unknown>(null);
  const lock = useRef(false),
    anchor = useRef<View>(null);
  const quiz = useQuery({
    queryKey: ["sharing-quiz", id, userId],
    queryFn: () => api.request<Quiz>(`quizzes/${id}/`),
  });
  const shares = useQuery({
    queryKey: ["shares", id, userId],
    queryFn: async () =>
      listOf(await api.request<SharedQuiz[]>(`shared-quizzes/?quiz=${id}`)),
    enabled: !!quiz.data?.can_edit,
  });
  const groups = useQuery({
    queryKey: ["groups", userId],
    queryFn: async () => listOf(await api.request<Group[]>("study-groups/")),
    enabled: !!quiz.data?.can_edit && invite,
  });
  const users = useQuery({
    queryKey: ["share-search", userId, submitted],
    queryFn: ({ signal }) =>
      api
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
  async function mutate(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function updateQuiz(patch: Partial<Quiz>) {
    const value = await api.patch<Quiz>(`quizzes/${id}/`, patch);
    cache.setQueryData(["sharing-quiz", id, userId], value);
    await Promise.all([
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
      const added = await api.post<SharedQuiz>("shared-quizzes/", {
        quiz_id: id,
        ...target,
        allow_edit: edit,
      });
      cache.setQueryData<SharedQuiz[]>(["shares", id, userId], (previous) => [
        ...(previous ?? []).filter((s) => s.id !== added.id),
        added,
      ]);
      await shares.refetch();
    });
  }
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
    const url = `${WEB_URL}/quiz/${id}`;
    try {
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
          void mutate(async () => {
            await api.patch(`shared-quizzes/${share.id}/`, { allow_edit });
            haptics.selection();
            await shares.refetch();
          });
        }}
        remove={(share) =>
          confirm(
            t("Odebrać dostęp?", "Remove Access?"),
            t(
              `${share.user?.full_name ?? share.group?.name ?? ""} straci dostęp do tego quizu.`,
              `${share.user?.full_name ?? share.group?.name ?? ""} will lose access to this quiz.`,
            ),
            () =>
              mutate(async () => {
                await api.delete(`shared-quizzes/${share.id}/`);
                await shares.refetch();
              }),
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
          {failure ? (
            <ErrorState
              title={t("Nie zapisano zmiany", "Change Not Saved")}
              error={failure}
            />
          ) : null}
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
                        grant: () => grant({ user_id: u.id }),
                      })),
                      ...foundGroups.map((g) => ({
                        id: g.id,
                        name: g.name,
                        detail: t("Grupa", "Group"),
                        group: true,
                        added: shares.data?.some((s) => s.group?.id === g.id),
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
                            busy ||
                            !!entry.added ||
                            shares.isPending ||
                            !!shares.error
                          }
                          onPress={entry.grant}
                        />
                      </Fragment>
                    ))}
                  </Collection>
                ) : null}
              </SettingsGroup>
            ))}
          {shares.isPending ? (
            <Label muted>{t("Wczytuję uprawnienia…", "Loading access…")}</Label>
          ) : shares.error ? (
            <ErrorState
              error={shares.error}
              retry={() => void shares.refetch()}
            />
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
                          mutate(async () => {
                            await api.patch(`shared-quizzes/${share.id}/`, {
                              allow_edit: !share.allow_edit,
                            });
                            await shares.refetch();
                          }),
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
                            () =>
                              mutate(async () => {
                                await api.delete(`shared-quizzes/${share.id}/`);
                                await shares.refetch();
                              }),
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
