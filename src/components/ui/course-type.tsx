import { cn } from "@/lib/utils";

// Mapping of course types to their respective background colors
// Colors from Solvro Planer except the color for D (diploma thesis) and G (course group) https://github.com/Solvro/web-planer/blob/fc9c9f19fab8743d707d5fe5f6b708b07740986b/frontend/src/components/class-block.tsx#L14
const typeBgColors = {
  W: "bg-red-200 dark:bg-red-900",
  L: "bg-blue-200 dark:bg-blue-900",
  C: "bg-green-200 dark:bg-green-900",
  S: "bg-orange-200 dark:bg-orange-900",
  P: "bg-fuchsia-200 dark:bg-fuchsia-900",
  D: "bg-teal-200 dark:bg-teal-900",
  G: "bg-yellow-200 dark:bg-yellow-900",
} as const;

interface CourseTypeProps {
  courseId: string;
}

function CourseType({ courseId }: CourseTypeProps) {
  if (!courseId || courseId.length === 0) {
    return null;
  }
  return (
    <span
      className={cn(
        "ml-1 inline-block rounded-full bg-gray-300 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200",
        typeBgColors[courseId.slice(-1) as keyof typeof typeBgColors],
      )}
    >
      {courseId.slice(-1)}
    </span>
  );
}

CourseType.displayName = "CourseType";

export { CourseType };
