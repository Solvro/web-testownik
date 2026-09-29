import GradeBadge from "./GradeBadge";
import type { GradeMenuProps } from "./GradeMenu.types";

// Other platforms pick predictions with the segmented control under each course.
export default function GradeMenu({ value, display }: GradeMenuProps) {
  return <GradeBadge value={value} label={display} />;
}
