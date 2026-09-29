import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useTheme } from "../../lib/theme";
import type { StatusViewProps } from "./StatusView.types";

export type { StatusAction, StatusViewProps } from "./StatusView.types";

export default function StatusView({ testID, ...props }: StatusViewProps) {
  const c = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 32,
      }}
    >
      <StatusContent {...props} />
    </ScrollView>
  );
}

/** The same message without its own scroll view, for inside a list. */
export function StatusContent({
  ionicon,
  title,
  description,
  actions = [],
}: Omit<StatusViewProps, "testID" | "symbol"> & { symbol?: string }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
      <Ionicons name={ionicon} size={48} color={c.muted} />
      <Text
        accessibilityRole="header"
        style={{
          color: c.text,
          fontSize: 22,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          selectable
          style={{
            color: c.muted,
            fontSize: 16,
            lineHeight: 22,
            textAlign: "center",
            maxWidth: 420,
          }}
        >
          {description}
        </Text>
      ) : null}
      {actions.length ? (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={action.onPress}
              style={({ pressed }) => ({
                minHeight: 40,
                paddingHorizontal: 20,
                justifyContent: "center",
                borderRadius: 20,
                backgroundColor: action.primary ? c.primary : c.fill,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: action.primary ? "#fff" : c.primary,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
