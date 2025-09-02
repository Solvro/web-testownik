import React from "react";

import { Loader } from "@/components/loader.tsx";
import type { Group, User } from "@/components/quiz/ShareQuizModal/types.ts";
import { PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SearchResultsPopoverProps {
  searchResults: (User | Group)[];
  searchResultsLoading: boolean;
  handleAddEntity: (entity: User | Group) => void;
  searchQuery: string;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function SearchResultsPopover({
  searchResults,
  searchResultsLoading,
  handleAddEntity,
  searchQuery,
  className,
  ref,
}: SearchResultsPopoverProps) {
  return (
    <PopoverContent
      ref={ref}
      align="start"
      side="bottom"
      sideOffset={4}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
      }}
      className={cn("w-[var(--radix-popover-trigger-width)] p-0", className)}
    >
      <ScrollArea className="w-full [&_[data-slot=scroll-area-viewport]]:max-h-64">
        <div className="flex flex-col gap-2 text-sm">
          {searchResultsLoading ? (
            <div className="flex justify-center pt-4 pb-8">
              <Loader size={8} />
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className="hover:bg-muted focus:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left focus:outline-none"
                onClick={() => {
                  handleAddEntity(result);
                }}
              >
                <img
                  src={result.photo}
                  alt="avatar"
                  className="size-8 rounded-full"
                />
                {"full_name" in result ? result.full_name : result.name}
              </button>
            ))
          ) : searchQuery.length >= 3 ? (
            <span className="text-muted-foreground py-2 text-center">
              Brak wyników
            </span>
          ) : (
            <span className="text-muted-foreground py-2 text-center">
              Wpisz co najmniej 3 znaki
            </span>
          )}
        </div>
      </ScrollArea>
    </PopoverContent>
  );
}
