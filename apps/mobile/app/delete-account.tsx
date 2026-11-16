import { Ionicons } from "@expo/vector-icons";
import type { User } from "@testownik/core/user/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ErrorState } from "../src/components/ui";
import { useConfirm } from "../src/lib/alerts";
import { api, listOf } from "../src/lib/api";
import { haptics } from "../src/lib/haptics";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import PersonAvatar from "../src/components/PersonAvatar";
import DestructiveButton from "../src/components/native/DestructiveButton";
import OptionIndicator from "../src/components/native/OptionIndicator";
import { useTheme } from "../src/lib/theme";
import { userError } from "../src/lib/user-error";

interface Impact {
  quizzes: number;
  public_quizzes: number;
  shared_people: number;
  shared_groups: number;
  recent_learners: number;
  sessions: number;
  ai_conversations: number;
}

export default function DeleteAccount() {
  const [client] = useState(() => api.forSession());
  // Material 3 on Android: primary list subheaders, no hairline dividers,
  // leading radio buttons and a filled error-coloured delete button.
  const android = Platform.OS === "android";
  const { t } = useLocale();
  const c = useTheme();
  const s = useSession();
  const confirm = useConfirm();
  const [keep, setKeep] = useState<"delete" | "transfer">("delete");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [heir, setHeir] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const removal = useRef(false);
  const searchReady = search.trim().length >= 3 && search.trim() === term;
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const impact = useQuery({
    queryKey: ["account-deletion", s.user?.id],
    networkMode: "always",
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      client.request<Impact>("mobile/account/deletion/", { signal }),
    gcTime: 0,
    enabled: !deleting,
  });
  const people = useQuery({
    queryKey: ["deletion-heir-search", s.user?.id, term],
    networkMode: "always",
    refetchOnReconnect: true,
    queryFn: async ({ signal }) =>
      listOf(
        await client.request<User[]>(
          `users/?search=${encodeURIComponent(term)}`,
          { signal },
        ),
      ).filter((person) => person.id !== s.user?.id),
    enabled: keep === "transfer" && searchReady && !deleting,
  });

  const data = impact.data;
  const transferring = keep === "transfer" && !!data?.quizzes;
  const affected =
    !!data &&
    (data.shared_people > 0 ||
      data.shared_groups > 0 ||
      data.recent_learners > 0 ||
      data.public_quizzes > 0);

  async function remove() {
    if (removal.current) return;
    if (transferring && !heir) return;
    const ownerId = s.user?.id;
    if (!ownerId) return;
    removal.current = true;
    setDeleting(true);
    setFailure(null);
    try {
      await client.post(
        "mobile/account/deletion/",
        transferring && heir ? { transfer_to_user_id: heir.id } : {},
      );
      haptics.success();
      // The server removed the account; clear this device and return to sign-in.
      await s.finishAccountDeletion(ownerId);
    } catch (error) {
      haptics.error();
      setFailure(error);
      setDeleting(false);
    } finally {
      removal.current = false;
    }
  }

  const row = (
    icon: React.ComponentProps<typeof Ionicons>["name"],
    text: string,
    first = false,
  ) => (
    <View key={text}>
      {first || android ? null : (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: c.border,
            marginLeft: 52,
          }}
        />
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Ionicons name={icon} size={20} color={c.muted} style={{ width: 22 }} />
        <Text style={{ flex: 1, fontSize: 16, color: c.text }}>{text}</Text>
      </View>
    </View>
  );
  const card = {
    backgroundColor: c.surface,
    borderRadius: android ? 20 : 14,
    borderCurve: "continuous" as const,
    overflow: "hidden" as const,
  };
  const heading = (text: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: c.muted,
        fontSize: 13,
        paddingHorizontal: 16,
        paddingTop: 12,
        ...(android
          ? { color: c.primary, fontSize: 14, fontWeight: "500" as const }
          : null),
      }}
    >
      {text}
    </Text>
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 48,
        gap: 10,
        maxWidth: 640,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: c.dangerBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="trash" size={30} color={c.destructive} />
        </View>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: c.text,
            textAlign: "center",
          }}
        >
          {t("Usuń konto", "Delete Account")}
        </Text>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 22,
            color: c.muted,
            textAlign: "center",
          }}
        >
          {t(
            "Tego nie da się cofnąć. Po usunięciu nie odzyskamy Twojego konta ani danych.",
            "This can’t be undone. Once deleted, your account and data can’t be recovered.",
          )}
        </Text>
      </View>

      {impact.isPending ? <ActivityIndicator style={{ padding: 24 }} /> : null}
      {impact.error ? (
        <ErrorState error={impact.error} retry={() => void impact.refetch()} />
      ) : null}

      {data ? (
        <>
          {heading(t("Zostanie usunięte", "What Will Be Deleted"))}
          <View style={card}>
            {[
              row(
                "person-circle-outline",
                t(
                  "Twój profil, zdjęcie i ustawienia",
                  "Your profile, photo and settings",
                ),
                true,
              ),
              row(
                "stats-chart-outline",
                t(
                  `Postępy w nauce (sesje: ${data.sessions})`,
                  `Your study progress (${data.sessions} sessions)`,
                ),
              ),
              ...(data.ai_conversations
                ? [
                    row(
                      "chatbubbles-outline",
                      t(
                        `Rozmowy z asystentem AI: ${data.ai_conversations}`,
                        `${data.ai_conversations} AI assistant conversations`,
                      ),
                    ),
                  ]
                : []),
              ...(data.quizzes && !transferring
                ? [
                    row(
                      "documents-outline",
                      t(
                        `Twoje quizy: ${data.quizzes}`,
                        `${data.quizzes} quizzes you created`,
                      ),
                    ),
                  ]
                : []),
            ]}
          </View>

          {affected && !transferring ? (
            <>
              {heading(t("Inni stracą dostęp", "Others Will Lose Access"))}
              <View style={card}>
                {[
                  ...(data.recent_learners
                    ? [
                        t(
                          `Osoby uczące się z Twoich quizów w ostatnich 30 dniach: ${data.recent_learners}`,
                          `${data.recent_learners} people studied your quizzes in the last 30 days`,
                        ),
                      ]
                    : []),
                  ...(data.shared_people
                    ? [
                        t(
                          `Osoby, którym udostępniono quizy: ${data.shared_people}`,
                          `${data.shared_people} people you shared quizzes with`,
                        ),
                      ]
                    : []),
                  ...(data.shared_groups
                    ? [
                        t(
                          `Grupy z dostępem: ${data.shared_groups}`,
                          `${data.shared_groups} groups with access`,
                        ),
                      ]
                    : []),
                  ...(data.public_quizzes
                    ? [
                        t(
                          `Quizy dostępne przez link lub publicznie: ${data.public_quizzes}`,
                          `${data.public_quizzes} quizzes open by link or public`,
                        ),
                      ]
                    : []),
                ].map((text, index) =>
                  row("people-outline", text, index === 0),
                )}
              </View>
              <Text
                style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16 }}
              >
                {t(
                  "Przekaż quizy innej osobie, aby nadal mogli się z nich uczyć.",
                  "Transfer your quizzes to someone so they can keep studying.",
                )}
              </Text>
            </>
          ) : null}

          {data.quizzes ? (
            <>
              {heading(t("Twoje quizy", "Your Quizzes"))}
              <View style={card}>
                {(
                  [
                    [
                      "delete",
                      t(
                        "Usuń je razem z kontem",
                        "Delete them with my account",
                      ),
                    ],
                    [
                      "transfer",
                      t("Przekaż je innej osobie", "Transfer them to someone"),
                    ],
                  ] as const
                ).map(([value, label], index) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{
                      checked: keep === value,
                      disabled: deleting,
                    }}
                    disabled={deleting}
                    onPress={() => {
                      haptics.selection();
                      setKeep(value);
                    }}
                    android_ripple={android ? { color: c.fill } : undefined}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 16,
                      minHeight: android ? 56 : 52,
                      borderTopWidth:
                        index && !android ? StyleSheet.hairlineWidth : 0,
                      borderColor: c.border,
                      opacity: pressed && !android ? 0.6 : 1,
                    })}
                  >
                    {android ? (
                      <OptionIndicator
                        selected={keep === value}
                        multiple={false}
                      />
                    ) : null}
                    <Text style={{ flex: 1, fontSize: 16, color: c.text }}>
                      {label}
                    </Text>
                    {keep === value && !android ? (
                      <Ionicons name="checkmark" size={20} color={c.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
              {transferring ? (
                <View style={{ gap: 10 }}>
                  {heir ? (
                    <View
                      style={[
                        card,
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                        },
                      ]}
                    >
                      <Avatar person={heir} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, color: c.text }}>
                          {heir.full_name}
                        </Text>
                        <Text style={{ fontSize: 13, color: c.muted }}>
                          {t(
                            `Otrzyma quizy (${data.quizzes}) i powiadomienie`,
                            `Receives ${data.quizzes} quizzes and a notification`,
                          )}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={deleting}
                        onPress={() => setHeir(null)}
                        hitSlop={8}
                      >
                        <Text style={{ color: c.primary, fontSize: 16 }}>
                          {t("Zmień", "Change")}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        editable={!deleting}
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t(
                          "Imię, nazwisko lub numer indeksu",
                          "Name or student number",
                        )}
                        accessibilityLabel={t("Znajdź osobę", "Find a person")}
                        placeholderTextColor={c.muted}
                        autoCorrect={false}
                        clearButtonMode="while-editing"
                        style={{
                          backgroundColor: c.surface,
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          minHeight: 46,
                          fontSize: 16,
                          color: c.text,
                        }}
                      />
                      <Text
                        style={{
                          color: c.muted,
                          fontSize: 13,
                          paddingHorizontal: 16,
                        }}
                      >
                        {search.trim().length < 3
                          ? t(
                              "Wpisz co najmniej 3 znaki, aby znaleźć osobę.",
                              "Enter at least 3 characters to find a person.",
                            )
                          : t(
                              "Wybierz osobę, która otrzyma Twoje quizy, aby kontynuować.",
                              "Choose who will receive your quizzes to continue.",
                            )}
                      </Text>
                      {searchReady && people.isFetching ? (
                        <ActivityIndicator />
                      ) : null}
                      {searchReady && people.error ? (
                        <ErrorState
                          error={people.error}
                          retry={() => void people.refetch()}
                        />
                      ) : null}
                      {searchReady &&
                      !people.error &&
                      people.data?.length === 0 ? (
                        <Text
                          style={{
                            color: c.muted,
                            fontSize: 13,
                            paddingHorizontal: 16,
                          }}
                        >
                          {t(
                            "Nie znaleziono nikogo. Ukryte profile nie pojawiają się w wynikach.",
                            "No one found. Hidden profiles don’t appear in results.",
                          )}
                        </Text>
                      ) : null}
                      {searchReady && people.data?.length ? (
                        <View style={card}>
                          {people.data.slice(0, 8).map((person, index) => (
                            <Pressable
                              key={person.id}
                              accessibilityRole="button"
                              accessibilityLabel={person.full_name}
                              disabled={deleting}
                              onPress={() => {
                                haptics.selection();
                                setHeir(person);
                              }}
                              style={({ pressed }) => ({
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                padding: 12,
                                borderTopWidth:
                                  index && !android
                                    ? StyleSheet.hairlineWidth
                                    : 0,
                                borderColor: c.border,
                                opacity: pressed ? 0.6 : 1,
                              })}
                            >
                              <Avatar person={person} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, color: c.text }}>
                                  {person.full_name}
                                </Text>
                                {person.student_number ? (
                                  <Text
                                    style={{ fontSize: 13, color: c.muted }}
                                  >
                                    {person.student_number}
                                  </Text>
                                ) : null}
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
            </>
          ) : null}

          {s.pending ? (
            <Text
              style={{ color: c.danger, fontSize: 13, paddingHorizontal: 16 }}
            >
              {t(
                `Odpowiedzi czekające na synchronizację (${s.pending}) zostaną utracone.`,
                `${s.pending} answers waiting to sync will be lost.`,
              )}
            </Text>
          ) : null}
          {failure ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.danger, fontSize: 13, paddingHorizontal: 16 }}
            >
              {userError(failure, t)}
            </Text>
          ) : null}
          <View style={{ paddingTop: 12 }}>
            <DestructiveButton
              disabled={deleting || (transferring && !heir)}
              onPress={() =>
                confirm(
                  t("Usunąć konto na zawsze?", "Delete Your Account Forever?"),
                  transferring && heir
                    ? t(
                        `Quizy trafią do: ${heir.full_name}. Wszystko inne zostanie trwale usunięte.`,
                        `Your quizzes go to ${heir.full_name}. Everything else is permanently deleted.`,
                      )
                    : t(
                        "Konto i wszystkie Twoje quizy zostaną trwale usunięte.",
                        "Your account and all your quizzes are permanently deleted.",
                      ),
                  remove,
                  { action: t("Usuń konto", "Delete Account") },
                )
              }
            >
              {deleting
                ? t("Usuwanie…", "Deleting…")
                : t("Usuń konto", "Delete Account")}
            </DestructiveButton>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Avatar({ person }: { person: User }) {
  return (
    <PersonAvatar
      name={person.full_name}
      photo={person.photo}
      level={person.account_level}
    />
  );
}
