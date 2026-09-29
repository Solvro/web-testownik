import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Text, View } from "react-native";

import { useTheme } from "../lib/theme";

// Material 3 Expressive grouped lists (Android 16 Settings, Files): each row is
// its own tonal segment, 2dp apart, with large outer and small inner corners.
const OUTER = 20;
const INNER = 4;

/** Flattens fragments and drops dividers; the gaps separate the segments. */
export function segments(children: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === CollectionDivider) return;
    if (child.type === Fragment)
      out.push(...segments((child.props as { children?: ReactNode }).children));
    else out.push(child);
  });
  return out;
}

export function segmentRadius(index: number, count: number) {
  return {
    borderTopLeftRadius: index === 0 ? OUTER : INNER,
    borderTopRightRadius: index === 0 ? OUTER : INNER,
    borderBottomLeftRadius: index === count - 1 ? OUTER : INNER,
    borderBottomRightRadius: index === count - 1 ? OUTER : INNER,
  };
}

export function Collection({ children }: { children: ReactNode }) {
  const c = useTheme();
  const rows = segments(children);
  return (
    <View style={{ gap: 2 }}>
      {rows.map((row, index) => (
        <View
          key={row.key ?? index}
          style={{
            ...segmentRadius(index, rows.length),
            backgroundColor: c.surface,
            overflow: "hidden",
          }}
        >
          {row}
        </View>
      ))}
    </View>
  );
}

/** Segments are separated by gaps, not hairlines. */
export function CollectionDivider() {
  return null;
}

// M3 list subheader: title-small in primary, aligned with the row text.
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
        paddingTop: 24,
        paddingBottom: 8,
        paddingHorizontal: 16,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          color: c.primary,
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "500",
          letterSpacing: 0.1,
        }}
      >
        {children}
      </Text>
      {trailing ? (
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: "500" }}>
          {trailing}
        </Text>
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
      style={{ gap: 2 }}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            ...segmentRadius(i, 4),
            height: 72,
            backgroundColor: c.surface,
            padding: 16,
            gap: 8,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              height: 16,
              width: i % 2 ? "55%" : "72%",
              borderRadius: 8,
              backgroundColor: c.fill,
            }}
          />
          <View
            style={{
              height: 12,
              width: "34%",
              borderRadius: 6,
              backgroundColor: c.fill,
            }}
          />
        </View>
      ))}
    </View>
  );
}
