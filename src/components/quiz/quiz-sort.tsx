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
import type { QuizMetadata } from "@/types/quiz";

interface Option {
  label: string;
  icon: React.ReactNode;
  comparator: (a: QuizMetadata, b: QuizMetadata) => number;
}

interface QuizSortProps {
  onSortChange: (
    comparator: (a: QuizMetadata, b: QuizMetadata) => number,
  ) => void;
  onNameFilterChange: (value: string) => void;
}

const defaultComparator = (_a: QuizMetadata, _b: QuizMetadata): number => {
  return 0;
};

const options: Option[] = [
  {
    label: "A - Z",
    icon: <ArrowDownAZ />,
    comparator: (a: QuizMetadata, b: QuizMetadata): number => {
      return a.title.localeCompare(b.title);
    },
  },
  {
    label: "Z - A",
    icon: <ArrowDownZA />,
    comparator: (a: QuizMetadata, b: QuizMetadata): number => {
      return b.title.localeCompare(a.title);
    },
  },
];

export function QuizSort({ onSortChange, onNameFilterChange }: QuizSortProps) {
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
            onClick={handleClearFilters}
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
