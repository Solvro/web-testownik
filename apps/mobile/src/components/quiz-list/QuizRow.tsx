import {
  Button,
  ContextMenu,
  HStack,
  Image,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  accessibilityValue,
  font,
  foregroundStyle,
  frame,
  lineLimit,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactElement } from "react";
import { useWindowDimensions } from "react-native";

import { useLocale } from "../../lib/locale";
import type { QuizListActions, QuizListItem } from "./types";

// SwiftUI building blocks for the iOS (*.ios.tsx) quiz lists.
export const secondary = foregroundStyle({
  type: "hierarchical",
  style: "secondary",
});
/** Stretches a row's text column across the free width, left-aligned. */
export const fill = frame({ maxWidth: Infinity, alignment: "leading" });
// List buttons tint their whole label; keep row content in label colors.
export const rowLabel = foregroundStyle({
  type: "hierarchical",
  style: "primary",
});

export function Chevron() {
  return (
    <Image
      systemName="chevron.right"
      size={13}
      modifiers={[foregroundStyle({ type: "hierarchical", style: "tertiary" })]}
    />
  );
}

export function QuizMenu({
  quiz,
  actions,
}: {
  quiz: QuizListItem;
  actions: QuizListActions;
}) {
  const { t } = useLocale();
  return (
    <ContextMenu.Items>
      <Button
        label={t("Ucz się", "Study")}
        systemImage="play"
        onPress={() => actions.open(quiz.id)}
      />
      {quiz.canEdit ? (
        <Button
          label={t("Edytuj", "Edit")}
          systemImage="pencil"
          onPress={() => actions.edit(quiz.id)}
        />
      ) : null}
      <Button
        label={t("Udostępnij", "Share")}
        systemImage="square.and.arrow.up"
        onPress={() => actions.share(quiz.id)}
      />
    </ContextMenu.Items>
  );
}

/** A tappable list row with the quiz's long-press actions. */
export default function QuizRow({
  quiz,
  actions,
  leading,
  label,
}: {
  quiz: QuizListItem;
  actions: QuizListActions;
  leading?: ReactElement;
  label?: string;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <ContextMenu>
      <ContextMenu.Trigger>
        <Button
          onPress={() => actions.open(quiz.id)}
          modifiers={[
            rowLabel,
            accessibilityLabel(label ?? quiz.title),
            accessibilityValue(quiz.detail),
          ]}
        >
          <HStack spacing={14}>
            {leading ?? (
              <Image
                systemName="doc.text"
                size={20}
                modifiers={[frame({ width: 28 }), secondary]}
              />
            )}
            {/* The text column takes the free width itself; a Spacer would
                split it and wrap titles early. */}
            <VStack alignment="leading" spacing={2} modifiers={[fill]}>
              <Text modifiers={fontScale > 1.3 ? [] : [lineLimit(2)]}>
                {quiz.title}
              </Text>
              <Text modifiers={[font({ textStyle: "footnote" }), secondary]}>
                {quiz.detail}
              </Text>
            </VStack>
            <Chevron />
          </HStack>
        </Button>
      </ContextMenu.Trigger>
      <QuizMenu quiz={quiz} actions={actions} />
    </ContextMenu>
  );
}
