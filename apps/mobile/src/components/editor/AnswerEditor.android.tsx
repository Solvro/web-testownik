import { Checkbox } from "@expo/ui/jetpack-compose";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import EditorImage from "../EditorImage";
import Overflow from "../Overflow";
import M3Host from "../native/M3Host";
import { Field } from "../ui";
import {
  clearedEditorImage,
  type AnswerEditorProps,
} from "./AnswerEditor.types";

// Material 3: an outlined text field per answer, a checkbox row to mark it
// correct (checkboxes, since several answers can be correct) and an overflow
// menu for the image and delete actions.
export default memo(function AnswerEditor({
  answer,
  index,
  questionId,
  canDelete,
  disabled,
  onPatch,
  onRemove,
  onUpload,
}: AnswerEditorProps) {
  const { t } = useLocale();
  const c = useTheme();
  const toggle = () =>
    onPatch(questionId, answer.id, { is_correct: !answer.is_correct });
  return (
    <View
      style={{
        backgroundColor: answer.is_correct ? c.successBg : c.surface,
        borderRadius: 16,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 4,
        marginBottom: 8,
      }}
    >
      <Field
        label={t(`Odpowiedź ${index + 1}`, `Answer ${index + 1}`)}
        multiline
        editable={!disabled}
        value={answer.text}
        onChangeText={(text) => onPatch(questionId, answer.id, { text })}
      />
      {answer.image || answer.image_url || answer.image_upload ? (
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
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={t(
            `Poprawna odpowiedź ${index + 1}`,
            `Correct answer ${index + 1}`,
          )}
          accessibilityState={{ checked: answer.is_correct, disabled }}
          disabled={disabled}
          android_ripple={{ color: c.fill }}
          onPress={toggle}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            minHeight: 48,
            marginLeft: -12,
            paddingLeft: 0,
            borderRadius: 24,
          }}
        >
          <View importantForAccessibility="no-hide-descendants">
            <M3Host matchContents>
              <Checkbox
                value={answer.is_correct}
                enabled={!disabled}
                onCheckedChange={toggle}
              />
            </M3Host>
          </View>
          <Text
            style={{
              color: answer.is_correct ? c.success : c.text,
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {t("Poprawna odpowiedź", "Correct Answer")}
          </Text>
        </Pressable>
        <Overflow
          label={t(
            `Opcje odpowiedzi ${index + 1}`,
            `Answer ${index + 1} options`,
          )}
          items={[
            {
              title: t("Dodaj obraz", "Add Image"),
              disabled,
              onPress: () => onUpload(questionId, answer.id),
            },
            {
              title: t("Usuń odpowiedź", "Delete Answer"),
              destructive: true,
              disabled: disabled || !canDelete,
              onPress: () => onRemove(questionId, answer.id),
            },
          ]}
        />
      </View>
    </View>
  );
});
