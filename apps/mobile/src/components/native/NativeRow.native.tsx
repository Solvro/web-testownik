import { userError, failureTitle } from "../../lib/user-error";
import { Host, ListItem, Text } from "@expo/ui";

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
    <Host
      matchContents={{ vertical: true }}
      style={{ width: "100%" }}
      seedColor={c.primary}
    >
      <ListItem
        colors={{
          containerColor: c.surface,
          contentColor: c.text,
          supportingContentColor: c.muted,
        }}
        supportingText={detail}
        onPress={
          onPress
            ? () => {
                void Promise.resolve()
                  .then(onPress)
                  .catch((e) => notify(failureTitle(t), userError(e, t)));
              }
            : undefined
        }
      >
        <Text>{title}</Text>
      </ListItem>
    </Host>
  );
}
