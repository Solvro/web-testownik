import { Children, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../lib/theme";

export function SectionTitle({
  children,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      accessibilityRole="header"
      // Matches SwiftUI's grouped list headers on iOS 26.
      style={{
        fontSize: 17,
        fontWeight: "600",
        color: c.muted,
        marginTop: 16,
        marginBottom: 2,
        paddingHorizontal: 16,
      }}
    >
      {children}
    </Text>
  );
}
export default function SettingsGroup({ children }: { children: ReactNode }) {
  const c = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginBottom: 4,
      }}
    >
      {rows.map((child, index) => (
        <View
          key={index}
          style={{
            borderTopWidth: index ? 0.5 : 0,
            borderColor: c.border,
            paddingVertical: 3,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
