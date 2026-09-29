import { memo } from "react";
import { View } from "react-native";
import { Button, Host, Image } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  accessibilityValue,
  buttonStyle,
  contentShape,
  disabled as disable,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import Overflow from "../Overflow";
import EditorImage from "../EditorImage";
import GrowingEditorInput from "./GrowingEditorInput";
import {
  clearedEditorImage,
  type AnswerEditorProps,
} from "./AnswerEditor.types";

/** Only the edited answer rerenders; UIKit retains its editing buffer and selection. */
export default memo(function AnswerEditor({
  answer,
  index,
  questionId,
  canDelete,
  disabled,
  autoFocus,
  onPatch,
  onRemove,
  onUpload,
}: AnswerEditorProps) {
  const { t } = useLocale();
  const c = useTheme();
  return (
    <View
      testID={`editor-answer-${index}`}
      style={{ paddingLeft: 4, paddingRight: 8, paddingVertical: 2 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Host ignoreSafeArea="all" style={{ width: 44, height: 44 }}>
          <Button
            onPress={() =>
              onPatch(questionId, answer.id, { is_correct: !answer.is_correct })
            }
            modifiers={[
              buttonStyle("plain"),
              frame({ width: 44, height: 44 }),
              contentShape(shapes.rectangle()),
              disable(!!disabled),
              accessibilityLabel(
                t(
                  `Poprawna odpowiedź ${index + 1}`,
                  `Correct answer ${index + 1}`,
                ),
              ),
              accessibilityValue(
                answer.is_correct ? t("Tak", "Yes") : t("Nie", "No"),
              ),
              accessibilityAddTraits(
                answer.is_correct ? ["isButton", "isSelected"] : ["isButton"],
              ),
            ]}
          >
            <Image
              systemName={
                answer.is_correct ? "checkmark.circle.fill" : "circle"
              }
              size={24}
              color={answer.is_correct ? c.primary : c.muted}
              modifiers={[frame({ width: 44, height: 44 })]}
            />
          </Button>
        </Host>
        <View style={{ flex: 1 }}>
          <GrowingEditorInput
            text={answer.text}
            // UIKit appends the placeholder to the label of an empty field;
            // label it only once there is text so VoiceOver says it once.
            accessibilityLabel={
              answer.text
                ? t(`Odpowiedź ${index + 1}`, `Answer ${index + 1}`)
                : undefined
            }
            editable={!disabled}
            autoFocus={autoFocus}
            onChangeText={(text) => onPatch(questionId, answer.id, { text })}
            placeholder={t(`Odpowiedź ${index + 1}`, `Answer ${index + 1}`)}
            inset={11}
          />
        </View>
        <Overflow
          label={t(
            `Opcje odpowiedzi ${index + 1}`,
            `Answer ${index + 1} options`,
          )}
          items={[
            {
              title: t("Dodaj obraz", "Add Image"),
              symbol: "photo",
              disabled,
              onPress: () => onUpload(questionId, answer.id),
            },
            {
              title: t("Usuń odpowiedź", "Delete Answer"),
              symbol: "trash",
              destructive: true,
              disabled: disabled || !canDelete,
              onPress: () => onRemove(questionId, answer.id),
            },
          ]}
        />
      </View>
      {answer.image || answer.image_url || answer.image_upload ? (
        <View style={{ paddingLeft: 46, paddingBottom: 10 }}>
          <EditorImage
            key={`${answer.id}:${answer.image_url ?? answer.image}`}
            uri={answer.image_url || answer.image}
            label={t(
              `Ilustracja odpowiedzi ${index + 1}`,
              `Answer ${index + 1} image`,
            )}
            disabled={disabled}
            onReplace={() => onUpload(questionId, answer.id)}
            onRemove={() => onPatch(questionId, answer.id, clearedEditorImage)}
          />
        </View>
      ) : null}
    </View>
  );
});
