import { requireNativeView } from "expo";
import type { NativeSyntheticEvent, ViewProps } from "react-native";
import type { QuestionListProps, QuestionRow } from "./QuestionList";
const NativeList = requireNativeView<
  ViewProps & {
    rows: QuestionRow[];
    selectedId: string;
    editing: boolean;
    moveUpLabel: string;
    moveDownLabel: string;
    onSelect: (event: NativeSyntheticEvent<{ id: string }>) => void;
    onMove: (
      event: NativeSyntheticEvent<{ id: string; beforeId: string | null }>,
    ) => void;
  }
>("LibraryDrag", "EditorQuestionListView");
export default function QuestionList({
  onSelect,
  onMove,
  ...props
}: QuestionListProps) {
  return (
    <NativeList
      {...props}
      style={{ flex: 1 }}
      onSelect={(event) => onSelect(event.nativeEvent.id)}
      onMove={(event) =>
        onMove(event.nativeEvent.id, event.nativeEvent.beforeId)
      }
    />
  );
}
