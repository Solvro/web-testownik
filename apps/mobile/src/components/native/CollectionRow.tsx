import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ImageProps } from "@expo/ui/swift-ui";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../lib/theme";
export interface CollectionRowProps {
  title: string;
  detail?: string;
  disclosure?: boolean;
  kind?:
    | "quiz"
    | "folder"
    | "archive"
    | "trash"
    | "offline"
    | "library"
    | "continue";
  onPress: () => void;
  accessibilityLabel?: string;
  /** Overrides the kind's icon: an SF Symbol on iOS, an Ionicon elsewhere. */
  symbol?: ImageProps["systemName"];
  ionicon?: ComponentProps<typeof Ionicons>["name"];
  disabled?: boolean;
}
export default function CollectionRow({
  title,
  detail,
  disclosure = true,
  kind = "quiz",
  onPress,
  accessibilityLabel,
  ionicon,
  disabled = false,
}: CollectionRowProps) {
  const c = useTheme(),
    { fontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={detail}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: kind === "continue" ? 100 : 64,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 14,
        opacity: disabled ? 0.45 : pressed ? 0.55 : 1,
      })}
    >
      <Ionicons
        name={
          ionicon ??
          (kind === "folder"
            ? "folder"
            : kind === "archive"
              ? "archive-outline"
              : kind === "trash"
                ? "trash-outline"
                : kind === "offline"
                  ? "download-outline"
                  : kind === "library"
                    ? "library-outline"
                    : kind === "continue"
                      ? "play-circle"
                      : "document-text-outline")
        }
        size={kind === "continue" ? 38 : 24}
        color={kind === "continue" || kind === "folder" ? c.primary : c.muted}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={fontScale > 1.3 ? undefined : 2}
          style={{
            color: c.text,
            fontSize: kind === "continue" ? 22 : 17,
            fontWeight: kind === "continue" ? "600" : "500",
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
        <Ionicons name="chevron-forward" size={13} color={c.muted} />
      ) : null}
    </Pressable>
  );
}
