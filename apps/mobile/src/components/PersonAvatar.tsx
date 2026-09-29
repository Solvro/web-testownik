import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { useTheme } from "../lib/theme";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("") || "?";

/** A person's photo, or their initials like on the web; groups get a people glyph. */
export default function PersonAvatar({
  name,
  photo,
  level,
  group = false,
  size = 36,
}: {
  name: string;
  photo?: string | null;
  level?: string | null;
  group?: boolean;
  size?: number;
}) {
  const c = useTheme();
  const ring =
    level === "gold" ? c.gold : level === "silver" ? c.muted : "transparent";
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring === "transparent" ? 0 : 1.5,
        borderColor: ring,
        backgroundColor: c.fill,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {group ? (
        <Ionicons name="people" size={size / 2} color={c.muted} />
      ) : (
        <Text
          style={{ color: c.muted, fontSize: size * 0.38, fontWeight: "600" }}
        >
          {initials(name)}
        </Text>
      )}
      {photo && !group ? (
        // Initials stay underneath while the photo loads or if it fails.
        <Image
          source={{ uri: photo }}
          style={{ position: "absolute", width: size, height: size }}
          transition={150}
        />
      ) : null}
    </View>
  );
}
