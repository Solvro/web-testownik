import { Badge } from "@/components/ui/badge";

// Mapping of course types to their respective background colors
// Colors from Solvro Planer except the color for D (diploma thesis) and G (course group) https://github.com/Solvro/web-planer/blob/fc9c9f19fab8743d707d5fe5f6b708b07740986b/frontend/src/components/class-block.tsx#L14
const typeBgColors: Record<string, string> = {
  W: "bg-red-500/15 text-red-600 dark:text-red-400",
  L: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  C: "bg-green-500/15 text-green-600 dark:text-green-400",
  S: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  P: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  D: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  G: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
};

interface CourseTypeBadgeProps {
  courseId: string;
}

function CourseTypeBadge({ courseId }: CourseTypeBadgeProps) {
  if (!courseId || courseId.length === 0) {
    return null;
  }

  const bgClass =
    typeBgColors[courseId.slice(-1)] ??
    "bg-gray-500/15 text-gray-600 dark:text-gray-400";

  return (
    <Badge variant="secondary" className={bgClass}>
      {courseId.slice(-1)}
    </Badge>
  );
}

CourseTypeBadge.displayName = "CourseType";

export { CourseTypeBadge };
