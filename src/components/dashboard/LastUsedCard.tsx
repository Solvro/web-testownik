import React, { useContext, useEffect, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import AppContext from "../../AppContext.tsx";
import { Link } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

interface Quiz {
  id: number;
  title: string;
}

const LastUsedCard: React.FC<React.ComponentProps<typeof Card>> = ({
  className,
  ...props
}) => {
  const appContext = useContext(AppContext);
  const [lastUsedQuizzes, setLastUsedQuizzes] = useState<Quiz[]>([]);
  const [fetchedAll, setFetchedAll] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchLastUsedQuizzes(10);
  }, []);

  const fetchLastUsedQuizzes = async (limit: number) => {
    setLoading(true);
    try {
      if (appContext.isGuest) {
        const guestQuizzes = localStorage.getItem("guest_quizzes");
        const selectedQuizzes = guestQuizzes
          ? JSON.parse(guestQuizzes).slice(0, limit)
          : [];
        if (selectedQuizzes.length < limit) {
          setFetchedAll(true);
        }
        setLastUsedQuizzes(selectedQuizzes);
        setLoading(false);
        return;
      }
      const response = await appContext.axiosInstance.get(
        "/last-used-quizzes/",
        {
          params: { limit: limit },
        },
      );
      const data: Quiz[] = response.data;
      if (data.length < limit) {
        setFetchedAll(true);
      }
      setLastUsedQuizzes(data);
    } catch {
      setLastUsedQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("max-h-80 md:max-h-none", className)} {...props}>
      <CardContent className="flex h-full flex-col space-y-3">
        <CardTitle>Ostatnio używane</CardTitle>
        <ScrollArea className="min-h-0 flex-1">
          <Table className="table-fixed">
            <TableBody>
              {lastUsedQuizzes.length > 0 ? (
                <>
                  {lastUsedQuizzes.map((quiz) => (
                    <TableRow key={quiz.id} className="hover:bg-transparent">
                      <TableCell>
                        <Link
                          to={`/quiz/${quiz.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          <div className="elipsis w-full truncate">
                            {quiz.title}
                          </div>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!fetchedAll &&
                    lastUsedQuizzes.length >= 10 &&
                    lastUsedQuizzes.length < 20 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="text-center">
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted-foreground h-6 text-xs"
                            onClick={() => fetchLastUsedQuizzes(20)}
                          >
                            Pokaż więcej
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                </>
              ) : loading ? (
                [...Array(10)].map((_, i) => {
                  const widths = ["w-1/3", "w-3/4", "w-2/3"];
                  const randomWidth =
                    widths[Math.floor(Math.random() * widths.length)];
                  return (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell>
                        <Skeleton className={cn("h-5", randomWidth)} />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
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
};

export default LastUsedCard;
