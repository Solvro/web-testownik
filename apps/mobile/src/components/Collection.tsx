import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";
export function Collection({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: c.surface,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}
export function CollectionDivider() {
  const c = useTheme();
  return (
    <View
      style={{
        marginLeft: 58,
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
      }}
    />
  );
}
export function CollectionHeading({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: 12,
        paddingTop: 26,
        paddingBottom: 10,
        paddingHorizontal: 4,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ flex: 1, color: c.text, fontSize: 20, fontWeight: "600" }}
      >
        {children}
      </Text>
      {trailing ? (
        <Text style={{ color: c.muted, fontSize: 13 }}>{trailing}</Text>
      ) : null}
    </View>
  );
}
export function CollectionSkeleton({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={{ gap: 1 }}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            height: 68,
            backgroundColor: c.surface,
            padding: 16,
            gap: 8,
          }}
        >
          <View
            style={{
              height: 16,
              width: i % 2 ? "55%" : "72%",
              borderRadius: 4,
              backgroundColor: c.border,
            }}
          />
          <View
            style={{
              height: 10,
              width: "34%",
              borderRadius: 3,
              backgroundColor: c.border,
            }}
          />
        </View>
      ))}
    </View>
  );
}
