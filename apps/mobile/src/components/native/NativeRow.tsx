import { userError, failureTitle } from "../../lib/user-error";
import { Pressable, StyleSheet, Text } from "react-native";

import { notify } from "../../lib/alerts";
import { useTheme } from "../../lib/theme";
import { useLocale } from "../../lib/locale";

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
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={() => {
        if (onPress)
          void Promise.resolve()
            .then(onPress)
            .catch((e) => notify(failureTitle(t), userError(e, t)));
      }}
      disabled={!onPress}
      style={{
        minHeight: 64,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        gap: 5,
      }}
    >
      <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
        {title}
      </Text>
      {detail ? (
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
