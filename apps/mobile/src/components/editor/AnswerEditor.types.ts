import type { Question } from "@testownik/core/quiz/types";
export type EditorAnswer = Question["answers"][number];
export interface AnswerEditorProps {
  answer: EditorAnswer;
  index: number;
  questionId: string;
  canDelete: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onPatch: (
    questionId: string,
    answerId: string,
    patch: Partial<EditorAnswer>,
  ) => void;
  onRemove: (questionId: string, answerId: string) => void;
  onUpload: (questionId: string, answerId: string) => Promise<void>;
}
export const clearedEditorImage = {
  image: null,
  image_url: null,
  image_upload: null,
  image_width: null,
  image_height: null,
};
