"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  IdCardLanyardIcon,
  LogInIcon,
  RefreshCwIcon,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useContext, useEffect, useState } from "react";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import { BannedScreen } from "@/components/banned-screen";
import { PrivacyDialog } from "@/components/privacy-dialog";
import { SolvroLogo } from "@/components/solvro-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_URL } from "@/lib/api";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

const getErrorMessage = (errorCode: string): React.ReactNode => {
  switch (errorCode) {
    case "not_student": {
      return (
        <span>
          Niestety, nie udało nam się zidentyfikować Cię jako studenta PWr.
          Upewnij się, że logujesz się na swoje konto studenta. Jeśli problem
          będzie się powtarzał,{" "}
          <a className="inline underline" href="mailto:testownik@solvro.pl">
            skontaktuj się z nami
          </a>
          .
        </span>
      );
    }
    case "invalid_token": {
      return "Token logowania jest nieprawidłowy lub wygasł. Spróbuj ponownie się zalogować.";
    }
    case "missing_token": {
      return "Brak tokenu logowania. Upewnij się, że kliknąłeś link z e-maila.";
    }
    case "server_error": {
      return "Wystąpił błąd serwera. Spróbuj ponownie się zalogować.";
    }
    case "usos_unavailable": {
      return "System USOS jest obecnie niedostępny. Spróbuj ponownie później.";
    }
    case "authorization_failed": {
      return "Nie udało się autoryzować Twojego konta. Spróbuj ponownie się zalogować.";
    }
    default: {
      return errorCode;
    }
  }
};

export function LoginPrompt(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("/");

  const searchParameters = useSearchParams();
  const pathname = usePathname();

  const error = searchParameters.get("error");
  const banReason =
    searchParameters.get("ban_reason") ?? searchParameters.get("reason");

  const retryCount = Number.parseInt(searchParameters.get("retry") ?? "0", 10);
  const [maxRetriesReached, setMaxRetriesReached] = useState(false);

  useEffect(() => {
    const redirect = searchParameters.get("redirect");
    const url = new URL(redirect ?? pathname, window.location.origin);
    setCurrentUrl(url.toString());
  }, [pathname, searchParameters]);

  useEffect(() => {
    if (!appContext.isAuthenticated) {
      return;
    }

    if (retryCount >= 3) {
      setMaxRetriesReached(true);
      return;
    }

    let delay = -1;

    switch (retryCount) {
      case 0: {
        delay = 1000;
        break;
      }
      case 1: {
        delay = 2000;
        break;
      }
      case 2: {
        delay = 5000;
        break;
      }
    }

    if (delay !== -1) {
      const timer = setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("retry", (retryCount + 1).toString());
        window.location.href = url.toString();
      }, delay);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [appContext.isAuthenticated, retryCount]);

  const signInAsGuest = () => {
    appContext.setGuest(true);
    setShowGuestDialog(false);
    const settings = localStorage.getItem("settings");
    const parsedSettings =
      settings !== null && settings !== ""
        ? (JSON.parse(settings) as Record<string, unknown>)
        : {};
    localStorage.setItem(
      "settings",
      JSON.stringify({
        ...DEFAULT_USER_SETTINGS,
        ...parsedSettings,
        sync_progress: false,
      }),
    );
  };

  if (error === "user_banned") {
    return <BannedScreen reason={banReason ?? undefined} />;
  }

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-lg pb-0">
        {appContext.isAuthenticated ? (
          <CardContent className="flex flex-col items-center py-8 text-center">
            <div className="bg-primary/10 mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <CheckCircle2Icon className="text-primary h-8 w-8" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Pomyślnie zalogowano</h2>

            {maxRetriesReached ? (
              <div className="text-destructive mt-4 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                <p className="font-medium">
                  Nie udało się automatycznie załadować danych.
                </p>
                <p className="text-sm opacity-80">
                  Odśwież stronę, aby spróbować ponownie.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-muted-foreground animate-pulse text-sm">
                  Ładowanie Twojego konta...
                </p>
              </div>
            )}

            <div className="mt-8 w-full">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.reload();
                }}
              >
                <RefreshCwIcon />
                Odśwież stronę
              </Button>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <AppLogo />
              </div>
              <CardDescription>Twoje narzędzie do nauki</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error !== null && error !== "" ? (
                <Alert variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>Błąd logowania</AlertTitle>
                  <AlertDescription>{getErrorMessage(error)}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mb-0 grid gap-2">
                <Button asChild size="lg" className="w-full">
                  <a
                    href={`${API_URL}/login/usos?jwt=true&redirect=${encodeURIComponent(currentUrl)}`}
                  >
                    <LogInIcon />
                    Zaloguj przez USOS
                  </a>
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card text-muted-foreground px-2">
                      lub
                    </span>
                  </div>
                </div>

                <Button asChild variant="outline" size="lg" className="w-full">
                  <a
                    href={`${API_URL}/login?jwt=true&redirect=${encodeURIComponent(currentUrl)}`}
                  >
                    <SolvroLogo width={20} />
                    Zaloguj z Solvro Auth
                  </a>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setShowGuestDialog(true);
                  }}
                >
                  <IdCardLanyardIcon />
                  Kontynuuj jako gość
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="link"
                  className="text-muted-foreground text-xs"
                  onClick={() => {
                    setShowPrivacyDialog(true);
                  }}
                >
                  Jak wykorzystujemy Twoje dane?
                </Button>
              </div>
            </CardContent>
            <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-1 border-t p-4 text-center text-xs">
              <span>Powered by</span>
              <a
                className="inline-flex items-center gap-1"
                href="https://solvro.pwr.edu.pl/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <SolvroLogo width={16} /> Solvro
              </a>
              <span className="font-semibold">&</span>
              <span>created by</span>
              <a
                href="https://github.com/Antoni-Czaplicki"
                target="_blank"
                rel="noopener noreferrer"
              >
                Antoni Czaplicki
              </a>
            </div>
          </>
        )}
      </Card>

      <PrivacyDialog
        open={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
      />
      <Dialog
        open={showGuestDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowGuestDialog(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IdCardLanyardIcon />
              Tryb gościa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <Alert>
              <AlertCircleIcon />
              <AlertTitle>
                Dane będą zapisywane tylko lokalnie w przeglądarce.
              </AlertTitle>
            </Alert>
            <p>
              Kontynuując jako gość, tracisz możliwość synchronizacji postępów
              między urządzeniami oraz tworzenia kopii zapasowej wyników.
            </p>
            <p>
              Możesz zalogować się później, aby przenieść swoje lokalne postępy
              na konto.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGuestDialog(false);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={signInAsGuest}>Rozumiem, wchodzę</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
