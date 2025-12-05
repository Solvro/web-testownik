import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowDownZA,
  SearchIcon,
  X,
} from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import type { QuizMetadata } from "@/types/quiz";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { Input } from "../ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.tsx";

interface Option {
  label: string;
  icon: React.ReactNode;
  comparator: (a: QuizMetadata, b: QuizMetadata) => number;
}

interface QuizSortProps {
  onSortChange: (
    comparator: (a: QuizMetadata, b: QuizMetadata) => number,
  ) => void;
  onNameFilterChange: (regex: RegExp) => void;
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

const buildRegex = (value: string): RegExp => {
  return new RegExp(value, "i");
};

export function QuizSort({ onSortChange, onNameFilterChange }: QuizSortProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const [searchedValue, setSearchedValue] = useState<string>("");

  const isFiltered: boolean = selectedOption !== null || searchedValue !== "";

  const handleClearFilters = () => {
    setSelectedOption(null);
    setSearchedValue("");
    onNameFilterChange(/.*/);
    onSortChange(defaultComparator);
  };

  return (
    <div className="flex flex-1 flex-row items-center justify-end gap-2">
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="size-9">
                <SearchIcon />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Szukaj</TooltipContent>
        </Tooltip>
        <PopoverContent
          collisionPadding={16}
          side="left"
          style={{ "--search-width": "20rem" } as React.CSSProperties}
          className="w-[min(var(--radix-popover-content-available-width),var(--search-width))] p-0"
        >
          <Input
            type="text"
            value={searchedValue}
            placeholder="Wyszukaj quiz"
            onChange={(event) => {
              onNameFilterChange(buildRegex(event.target.value));
              setSearchedValue(event.target.value);
            }}
          />
        </PopoverContent>
      </Popover>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={"outline"}
            className={`size-9 ${isFiltered ? "" : "hidden"}`}
            onClick={handleClearFilters}
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Wyczyść filtry</TooltipContent>
      </Tooltip>
    </div>
  );
}
