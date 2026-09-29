import { Ionicons } from "@expo/vector-icons";
import type { SharedQuiz } from "@testownik/core/quiz/types";
import type { Group, User } from "@testownik/core/user/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Fragment, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import PersonAvatar from "../src/components/PersonAvatar";
import AddAccessMenu from "../src/components/share/AddAccessMenu";
import { ErrorState, Field } from "../src/components/ui";
import { notify } from "../src/lib/alerts";
import { api, listOf } from "../src/lib/api";
import { haptics } from "../src/lib/haptics";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";
import { userError } from "../src/lib/user-error";

type Target =
  | {
      kind: "user";
      id: string;
      name: string;
      photo?: string | null;
      level?: string | null;
      detail?: string;
    }
  | { kind: "group"; id: string; name: string };

/** Find people and groups and give them access to a quiz, like a contacts picker. */
export default function ShareInvite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const userId = user?.id ?? "";
  const { t } = useLocale();
  const c = useTheme();
  const cache = useQueryClient();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const shares = useQuery({
    queryKey: ["shares", id, userId],
    queryFn: async () =>
      listOf(await api.request<SharedQuiz[]>(`shared-quizzes/?quiz=${id}`)),
  });
  const groups = useQuery({
    queryKey: ["groups", userId],
    queryFn: async () => listOf(await api.request<Group[]>("study-groups/")),
  });
  const people = useQuery({
    queryKey: ["share-search", userId, term],
    queryFn: async () =>
      listOf(
        await api.request<User[]>(`users/?search=${encodeURIComponent(term)}`),
      ),
    enabled: term.length >= 3,
  });

  const shared = new Set(
    (shares.data ?? []).map((share) => share.user?.id ?? share.group?.id),
  );
  const needle = term.toLocaleLowerCase();
  const groupTargets: Target[] = (groups.data ?? [])
    .filter(
      (group) => !needle || group.name.toLocaleLowerCase().includes(needle),
    )
    .map((group) => ({ kind: "group", id: group.id, name: group.name }));
  const peopleTargets: Target[] = (term.length >= 3 ? (people.data ?? []) : [])
    .filter((person) => person.id !== userId)
    .map((person) => ({
      kind: "user",
      id: person.id,
      name: person.full_name,
      photo: person.photo,
      level: person.account_level,
      detail: person.student_number,
    }));

  async function add(target: Target, role: "study" | "edit") {
    setAdding(target.id);
    try {
      await api.post("shared-quizzes/", {
        quiz_id: id,
        ...(target.kind === "user"
          ? { user_id: target.id }
          : { study_group_id: target.id }),
        allow_edit: role === "edit",
      });
      haptics.success();
      await cache.invalidateQueries({ queryKey: ["shares", id, userId] });
    } catch (error) {
      haptics.error();
      notify(t("Nie dodano", "Couldn’t Add"), userError(error, t));
    } finally {
      setAdding(null);
    }
  }

  const section = (title: string, targets: Target[]) =>
    targets.length ? (
      <>
        <Text
          accessibilityRole="header"
          style={{
            color: c.muted,
            fontSize: 17,
            fontWeight: "600",
            paddingHorizontal: 16,
            paddingTop: 16,
            // Material 3 list subheader.
            ...(Platform.OS === "android"
              ? { color: c.primary, fontSize: 14, fontWeight: "500" as const }
              : null),
          }}
        >
          {title}
        </Text>
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 14,
            borderCurve: "continuous",
            overflow: "hidden",
          }}
        >
          {targets.map((target, index) => {
            const added = shared.has(target.id);
            return (
              <Fragment key={target.id}>
                {index ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: c.border,
                      marginLeft: 64,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <PersonAvatar
                    name={target.name}
                    photo={target.kind === "user" ? target.photo : null}
                    level={target.kind === "user" ? target.level : null}
                    group={target.kind === "group"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, color: c.text }}>
                      {target.name}
                    </Text>
                    {target.kind === "user" && target.detail ? (
                      <Text style={{ fontSize: 13, color: c.muted }}>
                        {target.detail}
                      </Text>
                    ) : null}
                  </View>
                  {added ? (
                    <View
                      accessibilityLabel={t("Ma dostęp", "Has access")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={c.success}
                      />
                      <Text style={{ color: c.muted, fontSize: 14 }}>
                        {t("Dodano", "Added")}
                      </Text>
                    </View>
                  ) : (
                    <AddAccessMenu
                      name={target.name}
                      busy={adding === target.id}
                      disabled={adding !== null}
                      add={(role) => void add(target, role)}
                    />
                  )}
                </View>
              </Fragment>
            );
          })}
        </View>
      </>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: t("Dodaj osoby lub grupy", "Add People or Groups"),
          headerSearchBarOptions:
            Platform.OS === "web"
              ? undefined
              : {
                  placeholder: t(
                    "Osoba, numer indeksu lub grupa",
                    "Name, student number or group",
                  ),
                  autoCapitalize: "none",
                  hideWhenScrolling: false,
                  onChangeText: (event) => setQuery(event.nativeEvent.text),
                  onCancelButtonPress: () => setQuery(""),
                },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          gap: 8,
          paddingBottom: 40,
          maxWidth: 640,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {Platform.OS === "web" ? (
          <Field
            label={t(
              "Osoba, numer indeksu lub grupa",
              "Name, student number or group",
            )}
            value={query}
            onChangeText={setQuery}
          />
        ) : null}
        {shares.error ? (
          <ErrorState
            error={shares.error}
            retry={() => void shares.refetch()}
          />
        ) : null}
        {people.error ? (
          <ErrorState
            error={people.error}
            retry={() => void people.refetch()}
          />
        ) : null}
        {people.isFetching ? (
          <ActivityIndicator style={{ paddingTop: 12 }} />
        ) : null}
        {section(t("Osoby", "People"), peopleTargets)}
        {section(t("Twoje grupy", "Your Groups"), groupTargets)}
        {term.length > 0 && term.length < 3 ? (
          <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16 }}>
            {t(
              "Wpisz co najmniej 3 znaki, aby szukać osób.",
              "Type at least 3 characters to find people.",
            )}
          </Text>
        ) : null}
        {term.length >= 3 &&
        !people.isFetching &&
        !peopleTargets.length &&
        !groupTargets.length ? (
          <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16 }}>
            {t(
              "Nie znaleziono nikogo. Ukryte profile nie pojawiają się w wynikach.",
              "No one found. Hidden profiles don’t appear in results.",
            )}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
