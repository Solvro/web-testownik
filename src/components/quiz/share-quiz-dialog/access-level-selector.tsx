import { EarthIcon, Link2Icon, LockIcon, UsersIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface AccessLevelSelectorProps {
  value: number; // Current access level
  onChange: (level: number) => void; // Callback when access level changes
}

const levels = [
  { value: 0, label: "Prywatny", icon: LockIcon },
  { value: 1, label: "Dla udostępnionych", icon: UsersIcon },
  { value: 2, label: "Niepubliczny", icon: Link2Icon },
  { value: 3, label: "Publiczny", icon: EarthIcon },
];

export function AccessLevelSelector({
  value,
  onChange,
}: AccessLevelSelectorProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-stretch justify-center gap-2 py-1 sm:gap-2 md:flex-nowrap">
      {levels.map((level) => {
        const isSelected = value === level.value;
        const isHighlighted = value >= level.value;

        return (
          <button
            type="button"
            key={level.value}
            onClick={() => {
              onChange(level.value);
            }}
            className={cn(
              "group relative flex min-w-0 flex-1 basis-0 cursor-pointer flex-col items-center select-none",
              "md:min-w-20 md:flex-none md:basis-auto md:px-3",
              "rounded-lg p-2 transition-all duration-300 ease-in-out",
              !isHighlighted &&
                !isSelected &&
                "bg-neutral-500/5 dark:bg-white/5",
              isHighlighted &&
                "bg-blue-500/10 shadow-md dark:bg-blue-500/20 dark:shadow-blue-500/30",
              "hover:bg-blue-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:hover:bg-blue-500/30",
              isSelected &&
                "ring-offset-background ring-2 ring-blue-500/50 ring-offset-2",
            )}
          >
            <level.icon
              className={cn(
                "size-5 transition-all duration-300 sm:size-6",
                isHighlighted
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500",
                isSelected &&
                  "rounded-full border-[3px] border-blue-500 bg-white p-0.5 shadow-md dark:bg-gray-900",
              )}
            />
            <span
              className={cn(
                "mt-2 w-full truncate text-center whitespace-nowrap md:w-auto md:whitespace-normal",
                "text-xs transition-colors sm:text-sm",
                isHighlighted
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-300",
              )}
              title={level.label}
            >
              {level.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
