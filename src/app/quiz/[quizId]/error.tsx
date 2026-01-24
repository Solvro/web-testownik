"use client";

import {
  AlertCircleIcon,
  HomeIcon,
  LogInIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { GuestQuizNotFoundError } from "@/services/quiz.service";

export default function QuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const appContext = useContext(AppContext);

  if (error instanceof GuestQuizNotFoundError) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-3 text-center">
            <p>Quiz nie został znaleziony lub nie jest dostępny dla gości.</p>
            <p>
              Możesz spróbować się zalogować, aby uzyskać dostęp do tego quizu,
              lub skontaktować się z jego twórcą aby ustawić dostępność.
            </p>
            <div className="flex justify-center gap-2">
              <Button
                onClick={() => {
                  window.location.reload();
                }}
                variant="outline"
              >
                <RotateCcwIcon /> Spróbuj ponownie
              </Button>
              <Link href="/connect-account">
                <Button>
                  <LogInIcon />
                  Zaloguj się
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>Błąd podczas ładowania quizu</EmptyTitle>
        <EmptyDescription>
          Nie udało się załadować quizu. Może nie istnieć lub wystąpił problem z
          połączeniem.
        </EmptyDescription>
        {appContext.isAuthenticated ? (
          <EmptyDescription>
            Upewnij się, że quiz istnieje i masz do niego dostęp.
          </EmptyDescription>
        ) : (
          <EmptyDescription>
            Upewnij się, że quiz istnieje i został udostępniony także dla osób
            bez konta.
          </EmptyDescription>
        )}
      </EmptyHeader>
      <EmptyContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="error-details" className="border-none">
            <AccordionTrigger className="justify-center gap-2 py-2 hover:no-underline">
              Szczegóły błędu
            </AccordionTrigger>
            <AccordionContent className="bg-muted rounded-md p-4 text-left">
              <pre className="overflow-auto text-xs wrap-break-word whitespace-pre-wrap">
                {error.message}
              </pre>
              {error.digest != null && error.digest !== "" ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Digest: {error.digest}
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} variant="default">
            <RefreshCwIcon />
            Spróbuj ponownie
          </Button>
          {appContext.isAuthenticated ? (
            <Button asChild variant="outline">
              <Link href="/">
                <HomeIcon />
                Strona główna
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/connect-account">
                <LogInIcon />
                Zaloguj się
              </Link>
            </Button>
          )}
        </div>
        <EmptyDescription>
          Jeśli problem się powtarza, możesz utworzyć zgłoszenie na{" "}
          <a
            href="https://github.com/solvro/web-testownik/issues"
            target="_blank"
            rel="noreferrer"
          >
            GitHubie
          </a>
          .
        </EmptyDescription>
      </EmptyContent>
    </Empty>
  );
}
