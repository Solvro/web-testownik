import {
  ArrowDownAZIcon,
  ArrowDownUpIcon,
  ArrowDownZAIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  HistoryIcon,
  SearchIcon,
  X as XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { ViewTransition } from "react";

import { DEFAULT_LIBRARY_SORT_KEY } from "@/components/quiz/library-sort";
import type { LibrarySortKey } from "@/components/quiz/library-sort";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Option {
  key: LibrarySortKey;
  label: string;
  icon: ReactNode;
}

interface QuizSortProps {
  sortKey: LibrarySortKey;
  onSortKeyChange: (value: LibrarySortKey) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onResetFilters: () => void;
}

const sortingOptions: Option[] = [
  { key: "name-asc", label: "A → Z", icon: <ArrowDownAZIcon /> },
  { key: "name-desc", label: "Z → A", icon: <ArrowDownZAIcon /> },
  { key: "newest", label: "Najnowsze", icon: <CalendarArrowDownIcon /> },
  { key: "oldest", label: "Najstarsze", icon: <CalendarArrowUpIcon /> },
  { key: "last-used", label: "Ostatnio używane", icon: <HistoryIcon /> },
];

export function QuizSort({
  sortKey,
  onSortKeyChange,
  searchValue,
  onSearchValueChange,
  onResetFilters,
}: QuizSortProps) {
  const selectedOption =
    sortingOptions.find((option) => option.key === sortKey) ??
    sortingOptions.find((option) => option.key === DEFAULT_LIBRARY_SORT_KEY) ??
    sortingOptions[0];

  const isFiltered = sortKey !== DEFAULT_LIBRARY_SORT_KEY || searchValue !== "";

  return (
    <div className="flex flex-1 flex-row items-center justify-end gap-2">
      <ViewTransition>
        <div className="flex flex-row items-center gap-2">
          {isFiltered ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onResetFilters}
                    aria-label="Wyczyść filtry"
                  >
                    <XIcon />
                  </Button>
                }
              ></TooltipTrigger>
              <TooltipContent>Wyczyść filtry</TooltipContent>
            </Tooltip>
          ) : null}
          <InputGroup className="w-full sm:w-xs">
            <InputGroupInput
              placeholder="Wyszukaj quiz"
              value={searchValue}
              onChange={(event) => {
                onSearchValueChange(event.target.value);
              }}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Sortuj quizy"
                        className="bg-ring!"
                      >
                        {selectedOption.key === DEFAULT_LIBRARY_SORT_KEY ? (
                          <ArrowDownUpIcon />
                        ) : (
                          selectedOption.icon
                        )}
                      </Button>
                    }
                  ></DropdownMenuTrigger>
                }
              ></TooltipTrigger>
              <TooltipContent>Sortuj</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-full" align="end">
              {sortingOptions.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onClick={() => {
                    onSortKeyChange(option.key);
                  }}
                  className="flex w-auto justify-between"
                >
                  {option.label}
                  {option.icon}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ViewTransition>
    </div>
  );
}
