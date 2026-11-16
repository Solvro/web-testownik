import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { useLocale } from "../lib/locale";
import { useSession } from "../lib/session";
import { offlineImage } from "../lib/offline-images";
import { useTheme } from "../lib/theme";

export default function StudyImage({
  uri,
  label,
  height = 220,
}: {
  uri: string;
  label: string;
  height?: number;
}) {
  const { t } = useLocale(),
    c = useTheme();
  const { offline } = useSession();
  const [failure, setFailure] = useState<{
      uri: string;
      offline: boolean;
    } | null>(null),
    [attempt, setAttempt] = useState(0);
  if (failure && (failure.uri !== uri || (failure.offline && !offline)))
    setFailure(null);
  return failure?.uri === uri ? (
    <View style={{ gap: 4, paddingVertical: 8 }}>
      <Text style={{ color: c.muted }}>
        {offline
          ? t(
              "Ten obraz nie jest zapisany na urządzeniu. Połącz się z internetem, aby go pobrać.",
              "This image is not saved on this device. Connect to the internet to download it.",
            )
          : t(
              "Nie udało się wczytać obrazu.",
              "The image could not be loaded.",
            )}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`Wczytaj ponownie: ${label}`, `Reload: ${label}`)}
        onPress={(event) => {
          event.stopPropagation();
          setFailure(null);
          setAttempt((n) => n + 1);
        }}
        style={{
          minHeight: 44,
          justifyContent: "center",
          alignSelf: "flex-start",
          paddingHorizontal: 8,
        }}
      >
        <Text style={{ color: c.primary }}>
          {t("Spróbuj ponownie", "Try Again")}
        </Text>
      </Pressable>
    </View>
  ) : (
    <Image
      key={attempt}
      accessibilityLabel={label}
      // A copy saved with the offline quiz works without a connection.
      source={{ uri: offlineImage(uri) ?? uri }}
      onError={() => setFailure({ uri, offline })}
      contentFit="contain"
      transition={120}
      style={{ height, width: "100%" }}
    />
  );
}
