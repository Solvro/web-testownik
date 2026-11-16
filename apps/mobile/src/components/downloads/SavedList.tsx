import { Fragment } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";

import { Collection, CollectionDivider } from "../Collection";
import CollectionRow from "../native/CollectionRow";
import { Label, Screen } from "../ui";
import type { SavedListProps } from "./types";

export default function SavedList({
  title,
  help,
  items,
  open,
  remove,
}: SavedListProps) {
  const { t } = useLocale();
  const c = useTheme();
  return (
    <Screen>
      {title}
      <Label muted>{help}</Label>
      <Collection>
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index ? <CollectionDivider /> : null}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <CollectionRow
                  kind="offline"
                  title={item.title}
                  detail={item.detail}
                  onPress={() => open(item.id)}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  `Usuń „${item.title}” z urządzenia`,
                  `Remove ${item.title} from this device`,
                )}
                onPress={() => remove(item.id)}
                style={({ pressed }) => ({
                  minWidth: 48,
                  minHeight: 48,
                  marginRight: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.55 : 1,
                })}
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={c.destructive}
                />
              </Pressable>
            </View>
          </Fragment>
        ))}
      </Collection>
    </Screen>
  );
}
