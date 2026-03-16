"use client";

import { SiGithub } from "@icons-pack/react-simple-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useContributors } from "@/hooks/use-dashboard";
import { cn, getInitials } from "@/lib/utils";

export function AboutCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  const { data: contributors = [], isLoading } = useContributors();

  return (
    <Card
      className={cn("max-h-80 overflow-hidden md:max-h-none", className)}
      {...props}
    >
      <CardContent className="flex h-full flex-col space-y-3">
        <CardTitle className="flex items-center justify-between">
          <span>Twórcy</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() =>
              window.open("https://github.com/solvro/web-testownik")
            }
            className="rounded-full"
          >
            <SiGithub className="size-5" />
          </Button>
        </CardTitle>
        <ScrollArea className="min-h-0 flex-1">
          <Table>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow
                    key={`loading-contributor-${index.toString()}`}
                    className="transition-none hover:bg-transparent"
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
                    className="transition-none hover:bg-transparent"
                  >
                    <TableCell className="flex items-center gap-2 py-2">
                      <a
                        href={contributor.html_url}
                        target="_blank"
                        className="flex items-center gap-2 hover:underline"
                        rel="noreferrer"
                      >
                        <Avatar className="size-6">
                          <AvatarImage
                            src={`${contributor.avatar_url}&s=48`}
                            alt={`Zdjęcie profilowe twórcy ${contributor.login}`}
                          />
                          <AvatarFallback delayMs={600}>
                            {getInitials(contributor.login)}
                          </AvatarFallback>
                        </Avatar>
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
                <TableRow className="transition-none hover:bg-transparent">
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
