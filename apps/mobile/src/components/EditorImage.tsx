import { useState } from "react";
import { Image } from "expo-image";
import { View } from "react-native";
import { Button, Label } from "./ui";
import { useLocale } from "../lib/locale";
export default function EditorImage({
  uri,
  label,
  onReplace,
  onRemove,
  disabled,
}: {
  uri?: string | null;
  label: string;
  onReplace: () => Promise<void>;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      {uri && !failed ? (
        <Image
          accessibilityLabel={label}
          source={{ uri }}
          contentFit="contain"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: 180, borderRadius: 12 }}
        />
      ) : (
        <Label>
          {t(
            "Obraz jest dołączony, ale podgląd jest niedostępny.",
            "An image is attached, but its preview is unavailable.",
          )}
        </Label>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button kind="secondary" disabled={disabled} onPress={onReplace}>
            {t("Zmień obraz", "Replace Image")}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="danger" disabled={disabled} onPress={onRemove}>
            {t("Usuń obraz", "Remove Image")}
          </Button>
        </View>
      </View>
    </View>
  );
}
