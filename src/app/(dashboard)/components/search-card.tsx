"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  maintainer: string;
  is_anonymous: boolean;
}

export function SearchCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  const appContext = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, { wait: 500 });

  const {
    data: searchResults = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: ["search-quizzes", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) {
        return [];
      }
      const data = Object.values(
        await appContext.services.quiz.searchQuizzes(debouncedQuery),
      ).flat() as SearchResult[];

      const uniqueData = [...new Set(data.map((item) => item.id))].map((id) =>
        data.find((item) => item.id === id),
      ) as SearchResult[];

      return uniqueData;
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const showEmptyState =
    isFetched && searchResults.length === 0 && debouncedQuery.length > 0;

  return (
    <Card className={cn("max-h-80 md:max-h-none", className)} {...props}>
      <CardContent className="flex h-full flex-col space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Wyszukaj quiz"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={isLoading}
            aria-label="Wyszukaj quizy"
          >
            <SearchIcon className="size-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex justify-center pt-3">
              <Loader size={10} />
            </div>
          ) : (
            <Table>
              <TableBody>
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <TableRow key={result.id} className="hover:bg-transparent">
                      <TableCell>
                        <Link
                          href={`/quiz/${result.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          <div className="w-full text-wrap">
                            {result.title}
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              by{" "}
                              {result.is_anonymous
                                ? "anonim"
                                : result.maintainer}
                            </span>
                          </div>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : showEmptyState ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      Brak wyników wyszukiwania.
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      Tu pojawią się wyniki wyszukiwania.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
