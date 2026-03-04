"use client";

import {
  AlertCircleIcon,
  HomeIcon,
  LockIcon,
  LogInIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

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
import { API_URL } from "@/lib/api";
import { GuestQuizNotFoundError } from "@/services/quiz.service";

export default function QuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const appContext = useContext(AppContext);
  const [currentUrl, setCurrentUrl] = useState("/");
  const searchParameters = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const redirect = searchParameters.get("redirect");
    const url = new URL(redirect ?? pathname, window.location.origin);
    setCurrentUrl(url.toString());
  }, [pathname, searchParameters]);

  if (error instanceof GuestQuizNotFoundError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Brak dostępu dla gości</EmptyTitle>
          <EmptyDescription>
            Quiz nie został znaleziony lub nie jest dostępny dla gości.
          </EmptyDescription>
          <EmptyDescription>
            Możesz spróbować się zalogować, aby uzyskać dostęp do tego quizu,
            lub skontaktować się z jego twórcą aby ustawić dostępność.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => {
                window.location.reload();
              }}
              variant="outline"
            >
              <RotateCcwIcon /> Spróbuj ponownie
            </Button>
            <Button
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/connect-account">
                  <LogInIcon />
                  Zaloguj się
                </Link>
              )}
            ></Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

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
            {is401
              ? "Ten quiz jest dostępny tylko dla zalogowanych użytkowników."
              : "Nie masz dostępu do tego quizu. Skontaktuj się z jego twórcą aby ustawić dostępność."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/">
                  <HomeIcon />
                  Strona główna
                </Link>
              )}
            ></Button>
            {!appContext.isAuthenticated && (
              <Button
                nativeButton={false}
                render={(props) => (
                  <Link
                    {...props}
                    href={`${API_URL}/login/usos?jwt=true&redirect=${encodeURIComponent(
                      currentUrl,
                    )}`}
                  >
                    <LogInIcon />
                    Zaloguj się
                  </Link>
                )}
              ></Button>
            )}
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
        <Accordion className="w-full">
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
            <Button
              variant="outline"
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/">
                  <HomeIcon />
                  Strona główna
                </Link>
              )}
            ></Button>
          ) : (
            <Button
              variant="outline"
              nativeButton={false}
              render={(props) => (
                <Link
                  {...props}
                  href={`${API_URL}/login/usos?jwt=true&redirect=${encodeURIComponent(
                    currentUrl,
                  )}`}
                >
                  <LogInIcon />
                  Zaloguj się
                </Link>
              )}
            ></Button>
          )}
        </div>
        <EmptyDescription>
          Jeśli problem się powtarza, możesz utworzyć zgłoszenie na{" "}
          <Link
            href="https://github.com/solvro/web-testownik/issues"
            target="_blank"
            rel="noreferrer"
          >
            GitHubie
          </Link>
          .
        </EmptyDescription>
      </EmptyContent>
    </Empty>
  );
}
