"use client";

import {
  AlertCircleIcon,
  HomeIcon,
  LockIcon,
  LogInIcon,
  RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ACCOUNT_TYPE } from "@/types/user";

export default function QuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isAuthenticated, user } = useContext(AppContext);
  const isGuest = user?.account_type === ACCOUNT_TYPE.GUEST;
  const pathname = usePathname();

  if (error.message.includes("403") || error.message.includes("401")) {
    const is401 = error.message.includes("401");
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>
            {is401 ? "Wymagane logowanie" : "Brak dostępu"}
          </EmptyTitle>
          <EmptyDescription>
            {isGuest
              ? "Ten quiz nie jest dostępny dla gości, zaloguj się aby spróbować ponownie, lub skontaktuj się z twórcą quizu aby udostępnił go dla niezalogowanych użytkowników."
              : is401
                ? "Ten quiz jest dostępny tylko dla zalogowanych użytkowników."
                : "Nie masz dostępu do tego quizu. Skontaktuj się z jego twórcą aby ustawić dostępność."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/">
                <HomeIcon />
                Strona główna
              </Link>
            </Button>
            {!isAuthenticated ||
              (isGuest && (
                <Button asChild>
                  <Link href={`/login?redirect=${pathname}`}>
                    <LogInIcon />
                    Zaloguj się
                  </Link>
                </Button>
              ))}
          </div>
        </EmptyContent>
      </Empty>
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
        {isAuthenticated && !isGuest ? (
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
          {isAuthenticated && !isGuest ? (
            <Button asChild variant="outline">
              <Link href="/">
                <HomeIcon />
                Strona główna
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/login?redirect=${pathname}`}>
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
