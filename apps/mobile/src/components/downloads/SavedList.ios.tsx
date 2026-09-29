import {
  Button,
  HStack,
  Host,
  Image,
  List,
  Section,
  SwipeActions,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { font, frame, listStyle, tint } from "@expo/ui/swift-ui/modifiers";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { Chevron, fill, rowLabel, secondary } from "../quiz-list/QuizRow";
import type { SavedListProps } from "./types";

// A native list so rows can be swiped off the device, as in Files or Music.
export default function SavedList({
  title,
  help,
  items,
  open,
  remove,
}: SavedListProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <>
      {title}
      <Host style={{ flex: 1 }}>
        <List modifiers={[listStyle("insetGrouped")]}>
          <Section footer={<Text>{help}</Text>}>
            {items.map((item) => (
              <SwipeActions key={item.id}>
                <Button onPress={() => open(item.id)} modifiers={[rowLabel]}>
                  <HStack spacing={14}>
                    <Image
                      systemName="arrow.down.circle"
                      size={20}
                      modifiers={[frame({ width: 28 }), secondary]}
                    />
                    <VStack alignment="leading" spacing={2} modifiers={[fill]}>
                      <Text>{item.title}</Text>
                      {item.detail ? (
                        <Text
                          modifiers={[
                            font({ textStyle: "footnote" }),
                            secondary,
                          ]}
                        >
                          {item.detail}
                        </Text>
                      ) : null}
                    </VStack>
                    <Chevron />
                  </HStack>
                </Button>
                {/* Not a destructive role: unsynced answers ask first, and
                    SwiftUI would drop the row before that answer. */}
                <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                  <Button
                    label={t("Usuń z urządzenia", "Remove")}
                    systemImage="trash"
                    modifiers={[tint(c.destructive)]}
                    onPress={() => remove(item.id)}
                  />
                </SwipeActions.Actions>
              </SwipeActions>
            ))}
          </Section>
        </List>
      </Host>
    </>
  );
}
