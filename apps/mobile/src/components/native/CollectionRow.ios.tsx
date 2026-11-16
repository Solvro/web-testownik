import { SymbolView } from "expo-symbols";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { useTheme } from "../../lib/theme";
import type { CollectionRowProps } from "./CollectionRow";

// A React Native pressable rather than a SwiftUI button: inside sheets and
// scroll views it cancels when a drag starts, so pulling a sheet down never
// taps (or leaves highlighted) the row it began on.
export default function CollectionRow({
  title,
  detail,
  disclosure = true,
  kind = "quiz",
  onPress,
  accessibilityLabel: label,
  symbol: customSymbol,
  disabled = false,
  leading,
}: CollectionRowProps) {
  const c = useTheme(),
    { fontScale } = useWindowDimensions();
  const featured = kind === "continue";
  const symbol =
    customSymbol ??
    (kind === "folder"
      ? "folder.fill"
      : kind === "archive"
        ? "archivebox"
        : kind === "trash"
          ? "trash"
          : kind === "offline"
            ? "arrow.down.circle"
            : kind === "library"
              ? "books.vertical"
              : featured
                ? "play.circle.fill"
                : "doc.text");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityHint={detail}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      unstable_pressDelay={60}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        minHeight: featured ? 100 : 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: pressed ? c.fill : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <View style={{ width: featured ? 40 : 28, alignItems: "center" }}>
        {leading ?? (
          <SymbolView
            name={symbol}
            size={featured ? 38 : 24}
            tintColor={
              featured || kind === "folder" || customSymbol
                ? c.primary
                : c.muted
            }
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={fontScale > 1.3 ? undefined : 2}
          style={{
            color: c.text,
            fontSize: featured ? 20 : 17,
            fontWeight: featured ? "600" : "400",
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            numberOfLines={fontScale > 1.3 ? undefined : 1}
            style={{ color: c.muted, fontSize: 13 }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {disclosure ? (
        <SymbolView name="chevron.right" size={12} tintColor={c.muted} />
      ) : null}
    </Pressable>
  );
}
