import { Pressable, Text, View } from "react-native";

import { notify } from "../../lib/alerts";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";

// Rows live inside SettingsGroup cards, which already pad 16dp. A Compose
// ListItem adds its own 16dp inset, so titles sat further right than the
// switch, stepper and menu rows beside them. Keep the Material metrics
// (56dp min height, 16/14sp text, ripple) without the second inset.
export default function NativeRow({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string;
  onPress?: () => void | Promise<void>;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const content = (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 16 }}>{title}</Text>
      {detail ? (
        <Text style={{ color: c.muted, fontSize: 14 }}>{detail}</Text>
      ) : null}
    </View>
  );
  // Rows sit in a SettingsGroup segment padded 16dp; bleed into that padding
  // so the ripple fills the whole segment.
  const style = {
    minHeight: 56,
    paddingVertical: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    justifyContent: "center" as const,
  };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: c.fill }}
      onPress={() => {
        void Promise.resolve()
          .then(onPress)
          .catch((e) =>
            notify(t("Nie udało się", "Something Went Wrong"), userError(e, t)),
          );
      }}
      style={style}
    >
      {content}
    </Pressable>
  );
}
