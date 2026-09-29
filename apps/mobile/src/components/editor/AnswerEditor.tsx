import { memo } from "react";
import { View } from "react-native";
import { useLocale } from "../../lib/locale";
import { Card, Field } from "../ui";
import ToggleRow from "../ToggleRow";
import Overflow from "../Overflow";
import EditorImage from "../EditorImage";
import {
  clearedEditorImage,
  type AnswerEditorProps,
} from "./AnswerEditor.types";
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
  return (
    <Card>
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ToggleRow
            label={t(
              `Poprawna odpowiedź ${index + 1}`,
              `Correct Answer ${index + 1}`,
            )}
            value={answer.is_correct}
            disabled={disabled}
            onValueChange={(is_correct) =>
              onPatch(questionId, answer.id, { is_correct })
            }
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
    </Card>
  );
});
