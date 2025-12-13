import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowDownZA,
  SearchIcon,
  X as XIcon,
} from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import type { QuizMetadata, SharedQuiz } from "@/types/quiz";

interface Option {
  label: string;
  icon: React.ReactNode;
  comparator: (
    a: QuizMetadata | SharedQuiz,
    b: QuizMetadata | SharedQuiz,
  ) => number;
}

interface QuizSortProps {
  onSortChange: (
    comparator: (
      a: QuizMetadata | SharedQuiz,
      b: QuizMetadata | SharedQuiz,
    ) => number,
  ) => void;
  onNameFilterChange: (value: string) => void;
  onResetFilters: () => void;
}

const defaultComparator = (
  _a: QuizMetadata | SharedQuiz,
  _b: QuizMetadata | SharedQuiz,
): number => {
  return 0;
};

const getTitle = (quiz: QuizMetadata | SharedQuiz): string => {
  return "quiz" in quiz ? quiz.quiz.title : quiz.title;
};

const options: Option[] = [
  {
    label: "A - Z",
    icon: <ArrowDownAZ />,
    comparator: (
      a: QuizMetadata | SharedQuiz,
      b: QuizMetadata | SharedQuiz,
    ): number => {
      return getTitle(a).localeCompare(getTitle(b));
    },
  },
  {
    label: "Z - A",
    icon: <ArrowDownZA />,
    comparator: (
      a: QuizMetadata | SharedQuiz,
      b: QuizMetadata | SharedQuiz,
    ): number => {
      return getTitle(b).localeCompare(getTitle(a));
    },
  },
];

export function QuizSort({
  onSortChange,
  onNameFilterChange,
  onResetFilters,
}: QuizSortProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const [searchValue, setSearchValue] = useState<string>("");

  const isFiltered: boolean = selectedOption !== null || searchValue !== "";

  const handleClearFilters = () => {
    setSelectedOption(null);
    setSearchValue("");
    onNameFilterChange("");
    onSortChange(defaultComparator);
  };

  return (
    <div className="flex flex-1 flex-row items-center justify-end gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={"outline"}
            className={cn("size-9", !isFiltered && "hidden")}
            onClick={() => {
              onResetFilters();
              handleClearFilters();
            }}
          >
            <XIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Wyczyść filtry</TooltipContent>
      </Tooltip>
      <InputGroup className="w-full sm:w-xs">
        <InputGroupInput
          placeholder="Wyszukaj quiz"
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.target.value);
            onNameFilterChange(event.target.value);
          }}
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                {selectedOption === null ? (
                  <ArrowDownUp />
                ) : (
                  selectedOption.icon
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Sortuj</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {options.map((o) => (
            <DropdownMenuItem
              key={o.label}
              onClick={() => {
                setSelectedOption(o);
                onSortChange(o.comparator);
              }}
              className="flex w-auto justify-between"
            >
              {o.label}
              {o.icon}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
