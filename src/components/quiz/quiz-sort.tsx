import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowDownZA,
  SearchIcon,
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
}

const options: Option[] = [
  {
    label: "A do Z",
    icon: <ArrowDownAZ className="text-white" />,
    comparator: (a: QuizMetadata, b: QuizMetadata): number => {
      return a.title.localeCompare(b.title);
    },
  },
  {
    label: "Z do A",
    icon: <ArrowDownZA className="text-white" />,
    comparator: (a: QuizMetadata, b: QuizMetadata): number => {
      return b.title.localeCompare(a.title);
    },
  },
];

export function QuizSort({ onSortChange }: QuizSortProps) {
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);

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
        <PopoverContent side="left" className="p-0">
          <Input type="text" placeholder="Szukaj" />
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
    </div>
  );
}
