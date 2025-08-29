import React, { useContext, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import AppContext from "../../AppContext.tsx";
import { Link } from "react-router";
import Loader from "@/components/loader.tsx";
import { SearchIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { cn } from "@/lib/utils.ts";

interface SearchResult {
  id: string;
  title: string;
  maintainer: string;
  is_anonymous: boolean;
}

const SearchCard: React.FC<React.ComponentProps<typeof Card>> = ({
  className,
  ...props
}) => {
  const appContext = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSearchedEmpty, setIsSearchedEmpty] = useState<boolean>(true);

  const handleSearch = async () => {
    if (!searchQuery) {
      setIsSearchedEmpty(true);
      setSearchResults([]);
      return;
    }
    setIsSearchedEmpty(false);

    try {
      setLoading(true);
      if (appContext.isGuest) {
        const guestQuizzes = localStorage.getItem("guest_quizzes");
        const data = guestQuizzes ? JSON.parse(guestQuizzes) : [];
        const filteredData = data.filter((quiz: SearchResult) =>
          quiz.title.toLowerCase().includes(searchQuery.toLowerCase()),
        );
        setSearchResults(filteredData);
        setLoading(false);
        return;
      }
      const response = await appContext.axiosInstance.get(
        `/search-quizzes/?query=${encodeURIComponent(searchQuery)}`,
      );

      const data = Object.values(response.data).flat() as SearchResult[];
      const uniqueData = Array.from(new Set(data.map((item) => item.id))).map(
        (id) => data.find((item) => item.id === id),
      ) as SearchResult[];
      setSearchResults(uniqueData);
    } catch {
      setSearchResults([]);
    }
    setLoading(false);
  };

  return (
    <Card className={cn("max-h-80 md:max-h-none", className)} {...props}>
      <CardContent className="flex h-full flex-col space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Wyszukaj quiz"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleSearch}
            className="shrink-0"
          >
            <SearchIcon className="size-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex justify-center pt-3">
              <Loader color={"currentColor"} size={10} />
            </div>
          ) : (
            <Table>
              <TableBody>
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <TableRow key={result.id} className="hover:bg-transparent">
                      <TableCell>
                        <Link
                          to={`/quiz/${result.id}`}
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
                ) : isSearchedEmpty ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      Tu pojawią się wyniki wyszukiwania.
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      Brak wyników wyszukiwania.
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
};

export default SearchCard;
