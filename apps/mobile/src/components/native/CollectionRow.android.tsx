// Material 3 list item (Compose ListItem): leading icon, body-large headline,
// body-medium supporting text, full-row ripple. No trailing chevron: Material
// lists don't mark navigation rows.
import { Icon, ListItem, RNHostView, Text } from "@expo/ui/jetpack-compose";
import { clickable } from "@expo/ui/jetpack-compose/modifiers";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../lib/theme";
import type { CollectionRowProps } from "./CollectionRow";
import { symbolForIonicon } from "./materialIcons.android";
import M3Host from "./M3Host";

export default function CollectionRow({
  title,
  detail,
  kind = "quiz",
  onPress,
  ionicon,
  disabled = false,
}: CollectionRowProps) {
  const c = useTheme();
  const icon =
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
                : "document-text-outline");
  const hero = kind === "continue";
  const source = symbolForIonicon(icon);
  const tint = hero || kind === "folder" ? c.primary : c.muted;
  return (
    <M3Host
      matchContents={{ vertical: true }}
      style={{ width: "100%", opacity: disabled ? 0.38 : 1 }}
    >
      <ListItem
        colors={{
          containerColor: c.surface,
          contentColor: c.text,
          supportingContentColor: c.muted,
        }}
        // Keep the clickable modifier mounted: swapping it for none when
        // `disabled` flips makes Compose reject the modifiers prop update.
        modifiers={[
          clickable(() => {
            if (!disabled) onPress();
          }),
        ]}
      >
        <ListItem.HeadlineContent>
          <Text
            maxLines={2}
            overflow="ellipsis"
            style={{ typography: hero ? "titleLarge" : "bodyLarge" }}
          >
            {title}
          </Text>
        </ListItem.HeadlineContent>
        {detail ? (
          <ListItem.SupportingContent>
            <Text
              maxLines={1}
              overflow="ellipsis"
              style={{ typography: "bodyMedium" }}
            >
              {detail}
            </Text>
          </ListItem.SupportingContent>
        ) : null}
        <ListItem.LeadingContent>
          {source ? (
            <Icon source={source} tint={tint} size={hero ? 40 : 24} />
          ) : (
            <RNHostView matchContents>
              <Ionicons name={icon} size={hero ? 40 : 24} color={tint} />
            </RNHostView>
          )}
        </ListItem.LeadingContent>
      </ListItem>
    </M3Host>
  );
}
