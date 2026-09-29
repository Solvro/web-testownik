import { Children, isValidElement, type ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../lib/theme";
import { Collection, segmentRadius, segments } from "./Collection.android";

// M3 list subheader: title-small in primary.
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
      style={{
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "500",
        letterSpacing: 0.1,
        color: c.primary,
        marginTop: 16,
        paddingHorizontal: 16,
      }}
    >
      {children}
    </Text>
  );
}

// Material 3 Expressive settings group: one tonal segment per row.
export default function SettingsGroup({ children }: { children: ReactNode }) {
  const c = useTheme();
  // A Collection nested in the group contributes its rows as segments of
  // their own (full-bleed list items), not one padded block.
  const rows = Children.toArray(children)
    .filter(Boolean)
    .flatMap((child) =>
      isValidElement(child) && child.type === Collection
        ? segments((child.props as { children?: ReactNode }).children).map(
            (row) => ({ row, bleed: true }),
          )
        : [{ row: child, bleed: false }],
    );
  return (
    <View style={{ gap: 2, marginBottom: 4 }}>
      {rows.map(({ row, bleed }, index) => (
        <View
          key={index}
          style={{
            ...segmentRadius(index, rows.length),
            backgroundColor: c.surface,
            paddingHorizontal: bleed ? 0 : 16,
            overflow: "hidden",
          }}
        >
          {row}
        </View>
      ))}
    </View>
  );
}
