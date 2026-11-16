import { Ionicons } from "@expo/vector-icons";
import type { Group, User } from "@testownik/core/user/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
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
import { Button, EmptyState, ErrorState, Field } from "../src/components/ui";
import { listOf } from "../src/lib/api";
import { haptics } from "../src/lib/haptics";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";
import {
  confirmSharingGrant,
  sharingRead,
  sharingTargetKey,
} from "../src/lib/sharing-ack";
import { useSharingAction } from "../src/lib/use-sharing-action";

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
  const { t } = useLocale();
  if (!user) return null;
  if (typeof id !== "string" || !id.trim())
    return (
      <EmptyState
        symbol="books.vertical"
        ionicon="library-outline"
        title={t("Wybierz quiz", "Choose a Quiz")}
        description={t(
          "Otwórz quiz z biblioteki, aby zaprosić osoby lub grupy.",
          "Open a quiz from the library to invite people or groups.",
        )}
        actions={[
          {
            label: t("Przeglądaj bibliotekę", "Browse Library"),
            onPress: () => router.navigate("/library"),
          },
        ]}
      />
    );
  return <InviteForm key={`${user.id}:${id}`} id={id} userId={user.id} />;
}
function InviteForm({ id, userId }: { id: string; userId: string }) {
  const { client, session, busy, mutate, mounted, heldTargets } =
    useSharingAction(id, userId, true);
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
    networkMode: "always",
    queryFn: async ({ signal }) =>
      sharingRead(
        await client.request<unknown>(
          `shared-quizzes/?quiz=${encodeURIComponent(id)}`,
          { signal },
        ),
      ),
  });
  const groups = useQuery({
    queryKey: ["groups", userId],
    networkMode: "always",
    queryFn: async ({ signal }) =>
      listOf(await client.request<Group[]>("study-groups/", { signal })),
  });
  const people = useQuery({
    queryKey: ["share-search", userId, term],
    networkMode: "always",
    queryFn: async ({ signal }) =>
      listOf(
        await client.request<User[]>(
          `users/?search=${encodeURIComponent(term)}`,
          { signal },
        ),
      ),
    enabled: term.length >= 3 && term === query.trim(),
  });

  const shared = new Set(
    (shares.data ?? []).map((share) => share.user?.id ?? share.group?.id),
  );
  const currentSearch = term === query.trim();
  const needle = query.trim().toLocaleLowerCase();
  const groupTargets: Target[] = (groups.data ?? [])
    .filter(
      (group) => !needle || group.name.toLocaleLowerCase().includes(needle),
    )
    .map((group) => ({ kind: "group", id: group.id, name: group.name }));
  const peopleTargets: Target[] = (
    currentSearch && term.length >= 3 ? (people.data ?? []) : []
  )
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
    if (busy || !shares.data) return;
    setAdding(target.id);
    await mutate(async () => {
      const targetId =
        target.kind === "user"
          ? { user_id: target.id }
          : { study_group_id: target.id };
      if (heldTargets.includes(sharingTargetKey(targetId))) return;
      const confirmed = await confirmSharingGrant(
        cache,
        id,
        userId,
        session,
        targetId,
        () =>
          client.post("shared-quizzes/", {
            quiz_id: id,
            ...targetId,
            allow_edit: role === "edit",
          }),
      );
      if (confirmed && !session.aborted) haptics.success();
    });
    if (mounted.current) setAdding(null);
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
            const held = heldTargets.includes(
              sharingTargetKey(
                target.kind === "user"
                  ? { user_id: target.id }
                  : { study_group_id: target.id },
              ),
            );
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
                    {held ? (
                      <Text style={{ color: c.muted, fontSize: 13 }}>
                        {t("Sprawdzam dostęp…", "Checking access…")}
                      </Text>
                    ) : null}
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
                      disabled={busy || held || !shares.data}
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
        {shares.isPending || groups.isPending ? (
          <ActivityIndicator style={{ paddingTop: 12 }} />
        ) : null}
        {groups.error ? (
          <ErrorState
            error={groups.error}
            retry={() => void groups.refetch()}
          />
        ) : null}
        {currentSearch && people.error ? (
          <ErrorState
            error={people.error}
            retry={() => void people.refetch()}
          />
        ) : null}
        {currentSearch && people.isFetching ? (
          <ActivityIndicator style={{ paddingTop: 12 }} />
        ) : null}
        {section(t("Osoby", "People"), peopleTargets)}
        {section(t("Twoje grupy", "Your Groups"), groupTargets)}
        {query.trim().length > 0 && query.trim().length < 3 ? (
          <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16 }}>
            {t(
              "Wpisz co najmniej 3 znaki, aby szukać osób.",
              "Type at least 3 characters to find people.",
            )}
          </Text>
        ) : null}
        {currentSearch &&
        term.length >= 3 &&
        !people.isFetching &&
        !people.error &&
        !groups.error &&
        !groups.isPending &&
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
