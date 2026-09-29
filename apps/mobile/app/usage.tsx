import type { AIUsageSummary } from "@testownik/core/ai/usage";
import { AI_USAGE_SCOPE_LABELS } from "@testownik/core/ai/usage";
import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorScreen, Loading } from "../src/components/ui";
import { usageWindow, usageWindowLabels } from "../src/lib/ai-usage";
import { api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";

const SCOPE_EN: Record<string, string> = {
  chat: "Assistant",
  explain: "Explanations",
  hint: "Hints",
  quiz_generation: "Quiz generation",
  adjustment: "Adjustments",
};

/** AI allowance for the current session and this week, with recent activity. */
export default function Usage() {
  const s = useSession();
  const c = useTheme();
  const { t, language } = useLocale();
  const usage = useQuery({
    queryKey: ["ai-usage", s.user?.id],
    queryFn: () => api.request<AIUsageSummary>("ai/usage/me/?days=7"),
  });
  // Same cache as the settings screen; only used to name models.
  const catalog = useQuery({
    queryKey: ["ai-models", s.user?.id],
    queryFn: () =>
      api.request<{
        models: { model: string; label: string; provider?: string }[];
      }>("ai/models/"),
  });
  const modelName = (id: string) =>
    catalog.data?.models.find((model) => model.model === id)?.label || id;
  if (usage.isPending) return <Loading />;
  if (!usage.data?.session)
    return (
      <ErrorScreen error={usage.error} retry={() => void usage.refetch()} />
    );
  const data = usage.data;
  const requests = data.daily.reduce((sum, day) => sum + day.events, 0);
  const busiest = Math.max(1, ...data.daily.map((day) => day.events));
  const scopes = [...data.by_scope]
    .filter((item) => item.events > 0)
    .sort((a, b) => b.events - a.events);
  const models = [...data.by_model]
    .filter((item) => item.events > 0)
    .sort((a, b) => b.events - a.events);
  const weekday = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(
      language === "pl" ? "pl-PL" : "en-GB",
      { weekday: "short" },
    );
  const card = {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderCurve: "continuous" as const,
    padding: 16,
    gap: 12,
  };
  const row = (label: string, value: string, key: string, first: boolean) => (
    <View
      key={key}
      style={{
        flexDirection: "row",
        paddingVertical: 12,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderColor: c.border,
      }}
    >
      <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{label}</Text>
      <Text
        style={{ color: c.muted, fontSize: 16, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
  const requestLabel = (n: number) =>
    t(`${n} zapyt.`, `${n} ${n === 1 ? "request" : "requests"}`);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
    >
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()}>
            {t("Zamknij", "Close")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {(
          [
            ["session", usageWindowLabels(t).session, data.session],
            ["week", usageWindowLabels(t).weekly, data.weekly],
          ] as const
        ).map(([key, title, raw]) => {
          const view = usageWindow(raw, t);
          const percent = Math.round(view.fraction * 100);
          return (
            <View key={key} testID={`usage-${key}`} style={[card, { flex: 1 }]}>
              <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                {title}
              </Text>
              <Text
                style={{
                  color: view.fraction >= 0.9 ? c.destructive : c.text,
                  fontSize: view.unlimited ? 20 : 28,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {view.unlimited
                  ? t("Bez limitu", "No Limit")
                  : t(`${percent}%`, `${percent}%`)}
              </Text>
              {view.unlimited ? null : (
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: percent }}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: c.fill,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${percent}%`,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor:
                        view.fraction >= 0.9 ? c.destructive : c.primary,
                    }}
                  />
                </View>
              )}
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {view.unlimited
                  ? t("Twoje konto nie ma limitu", "Your account has no limit")
                  : (view.resets ?? t("Wykorzystano", "Used"))}
              </Text>
            </View>
          );
        })}
      </View>
      {data.exhausted ? (
        <Text
          style={{ color: c.destructive, fontSize: 13, paddingHorizontal: 4 }}
        >
          {t(
            "Limit został wykorzystany. Asystent wróci po odnowieniu.",
            "You’ve reached your limit. The assistant is back after it renews.",
          )}
        </Text>
      ) : null}

      <>
        <View style={card}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 17,
                fontWeight: "600",
              }}
            >
              {t("Aktywność", "Activity")}
            </Text>
            <Text style={{ color: c.muted, fontSize: 15 }}>
              {requestLabel(requests)}
            </Text>
          </View>
          <View
            accessibilityLabel={data.daily
              .map((day) => `${weekday(day.date)}: ${requestLabel(day.events)}`)
              .join(", ")}
            accessible
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 8,
              height: 140,
            }}
          >
            {data.daily.map((day) => (
              <View
                key={day.date}
                style={{ flex: 1, alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: "100%",
                    maxWidth: 28,
                    height: Math.max(4, (day.events / busiest) * 104),
                    borderRadius: 6,
                    backgroundColor: day.events ? c.primary : c.fill,
                  }}
                />
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {weekday(day.date)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        {scopes.length ? (
          <View style={[card, { gap: 0, paddingVertical: 4 }]}>
            {scopes.map((item, index) =>
              row(
                language === "pl"
                  ? (AI_USAGE_SCOPE_LABELS[item.scope ?? ""] ??
                      item.scope ??
                      "")
                  : (SCOPE_EN[item.scope ?? ""] ?? item.scope ?? ""),
                requestLabel(item.events),
                item.scope ?? String(index),
                index === 0,
              ),
            )}
          </View>
        ) : null}
        {models.length ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16 }}
            >
              {t("Modele", "Models")}
            </Text>
            <View style={[card, { gap: 0, paddingVertical: 4 }]}>
              {models.map((item, index) =>
                row(
                  modelName(item.model ?? ""),
                  requestLabel(item.events),
                  item.model ?? String(index),
                  index === 0,
                ),
              )}
            </View>
          </View>
        ) : null}
      </>
      <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 4 }}>
        {t(
          "Limit 5-godzinny liczy się od pierwszego zapytania. Podpowiedzi, wyjaśnienia i asystent korzystają z tego samego limitu.",
          "The 5-hour window starts with your first request. Hints, explanations and the assistant share the same allowance.",
        )}
      </Text>
    </ScrollView>
  );
}
