// Material 3 segmented buttons instead of the shared pill picker.
import Choice from "../native/Choice.android";
import type { ChoiceProps } from "../native/Choice";

export default function GradesPicker(props: ChoiceProps) {
  return <Choice {...props} segmented />;
}
