"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useLastUsedQuizzes } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

interface LastUsedCardProps extends React.ComponentProps<typeof Card> {
  isGuest: boolean;
}

export function LastUsedCard({
  className,
  isGuest,
  ...props
}: LastUsedCardProps): React.JSX.Element {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useLastUsedQuizzes(isGuest);

  const quizzes = data?.pages.flatMap((page) => page.results) ?? [];
  const { ref, inView } = useInView({
    rootMargin: "200%",
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      void fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  return (
    <Card className={cn("max-h-80 md:max-h-none", className)} {...props}>
      <CardContent className="flex h-full flex-col space-y-3">
        <CardTitle>Ostatnio używane</CardTitle>
        <ScrollArea className="min-h-0 flex-1">
          <Table className="table-fixed">
            <TableBody>
              {quizzes.length > 0 ? (
                <>
                  {quizzes.map((quiz) => (
                    <TableRow
                      key={quiz.id}
                      className="transition-none hover:bg-transparent"
                    >
                      <TableCell>
                        <Link
                          href={`/quiz/${quiz.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          <div className="elipsis w-full truncate">
                            {quiz.title}
                          </div>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {hasNextPage ? (
                    <TableRow
                      ref={ref}
                      className="transition-none hover:bg-transparent"
                    >
                      <TableCell className="text-center">
                        {isFetchingNextPage ? (
                          <span className="text-muted-foreground text-xs">
                            Ładowanie...
                          </span>
                        ) : (
                          <span className="sr-only">Wczytaj więcej</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </>
              ) : isLoading ? (
                Array.from({ length: 10 }).map((_, index) => {
                  const widths = ["w-1/3", "w-3/4", "w-2/3"];
                  const randomWidth =
                    widths[Math.floor(Math.random() * widths.length)];
                  return (
                    <TableRow
                      key={`loading-last-used-${index.toString()}`}
                      className="transition-none hover:bg-transparent"
                    >
                      <TableCell>
                        <Skeleton className={cn("h-5", randomWidth)} />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="transition-none hover:bg-transparent">
                  <TableCell className="text-muted-foreground text-xs">
                    Brak ostatnio używanych quizów.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
