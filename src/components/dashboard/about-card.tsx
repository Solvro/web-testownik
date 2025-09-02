import { SiGithub } from "@icons-pack/react-simple-icons";
import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils.ts";

interface Contributor {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  contributions: number;
}

export function AboutCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchContributors = async () => {
    setLoading(true);
    try {
      const coreResponse = await fetch(
        "https://api.github.com/repos/Solvro/backend-testownik/contributors?anon=1",
      );
      const frontendResponse = await fetch(
        "https://api.github.com/repos/Solvro/web-testownik/contributors?anon=1",
      );

      if (!coreResponse.ok || !frontendResponse.ok) {
        throw new Error("Failed to fetch contributors");
      }

      const coreData = (await coreResponse.json()) as Contributor[];
      const frontendData = (await frontendResponse.json()) as Contributor[];

      // merge data from both repositories and if there are any duplicates, sum their contributions
      const data = [...coreData, ...frontendData]
        .filter((contributor: Contributor) => contributor.type === "User")
        .reduce((accumulator: Contributor[], contributor: Contributor) => {
          const existingContributor = accumulator.find(
            (c) => c.login === contributor.login,
          );
          if (existingContributor === undefined) {
            accumulator.push(contributor);
          } else {
            existingContributor.contributions += contributor.contributions;
          }
          return accumulator;
        }, []);

      setContributors(
        data.sort(
          (a: Contributor, b: Contributor) => b.contributions - a.contributions,
        ),
      );
    } catch (error) {
      console.error(error);
      setContributors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContributors();
  }, []);

  return (
    <Card className={cn("max-h-80 md:max-h-none", className)} {...props}>
      <CardContent className="flex h-full flex-col space-y-3">
        <CardTitle className="flex items-center justify-between">
          <span>Twórcy</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              window.open("https://github.com/solvro/web-testownik")
            }
            className="size-6 rounded-full"
          >
            <SiGithub className="size-5" />
          </Button>
        </CardTitle>
        <ScrollArea className="min-h-0 flex-1">
          <Table>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow
                    key={`loading-contributor-${index.toString()}`}
                    className="hover:bg-transparent"
                  >
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-6 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Skeleton className="h-3 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : contributors.length > 0 ? (
                contributors.map((contributor) => (
                  <TableRow
                    key={contributor.id}
                    className="hover:bg-transparent"
                  >
                    <TableCell className="flex items-center gap-2 py-2">
                      <a
                        href={contributor.html_url}
                        target="_blank"
                        className="flex items-center gap-2 hover:underline"
                        rel="noreferrer"
                      >
                        <img
                          src={contributor.avatar_url}
                          alt={contributor.login}
                          className="size-6 rounded-full object-cover"
                        />
                        <span className="text-muted-foreground text-sm">
                          {contributor.login}
                        </span>
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2 text-xs">
                      {contributor.contributions} commits
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell className="text-muted-foreground text-xs">
                    Nie udało się pobrać informacji o autorach
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
