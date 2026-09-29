import { userError, failureTitle } from "../lib/user-error";
import { MenuView } from "@expo/ui/community/menu";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { useTheme } from "../lib/theme";
import { useLocale } from "../lib/locale";
import type { OverflowProps } from "./Overflow";
import { notify } from "./ui";

export default function Overflow({
  items,
  label,
  icon = "ellipsis-horizontal",
}: OverflowProps) {
  const c = useTheme();
  const { t } = useLocale();
  const menuLabel = label ?? t("Opcje", "Options");
  return (
    <MenuView
      title={menuLabel}
      actions={items.map((i, index) => ({
        id: String(index),
        title: i.title,
        // Material menus have no other way to show the active choice (e.g. sort).
        state: i.selected ? ("on" as const) : undefined,
        attributes: { destructive: i.destructive, disabled: i.disabled },
      }))}
      onPressAction={({ nativeEvent }) => {
        void Promise.resolve()
          .then(items[Number(nativeEvent.event)].onPress)
          .catch((e) =>
            notify(
              failureTitle(t, items[Number(nativeEvent.event)].title),
              userError(e, t),
            ),
          );
      }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={menuLabel}
        style={{
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          // Android overflow menus use the vertical "more" glyph.
          name={
            icon === "sort"
              ? "swap-vertical"
              : icon === "ellipsis-horizontal"
                ? "ellipsis-vertical"
                : icon
          }
          size={24}
          color={c.text}
        />
      </View>
    </MenuView>
  );
}
