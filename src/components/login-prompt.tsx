"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useContext, useEffect, useState } from "react";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import { Loader } from "@/components/loader";
import { PrivacyDialog } from "@/components/privacy-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_URL } from "@/lib/api";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

export function LoginPrompt(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  const searchParameters = useSearchParams();
  const pathname = usePathname();
  const error = searchParameters.get("error");

  useEffect(() => {
    const redirect = searchParameters.get("redirect");
    const url = new URL(redirect ?? "", window.location.origin);
    setCurrentUrl(url.toString());
  }, [pathname, searchParameters]);

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

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-xl min-w-1/2 pb-2">
        {appContext.isAuthenticated ? (
          <CardContent className="flex flex-col items-center py-10">
            <p className="mb-2 text-xl font-semibold text-green-600 dark:text-green-400">
              Zalogowano pomyślnie!
            </p>
            <Loader size={15} />
            <p className="text-muted-foreground mt-4 text-sm">
              Pobieranie twoich danych...
            </p>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Witaj w Testowniku Solvro!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {error == null ? null : (
                <Alert variant="destructive" className="text-sm">
                  <AlertTitle className="font-medium">
                    Wystąpił błąd podczas logowania.
                  </AlertTitle>
                  {error === "not_student" ? (
                    <AlertDescription>
                      Niestety, nie udało nam się zidentyfikować Cię jako
                      studenta PWr. Upewnij się, że logujesz się na swoje konto
                      studenta. Jeśli problem będzie się powtarzał,{" "}
                      <a
                        className="underline"
                        href="mailto:testownik@solvro.pl"
                      >
                        skontaktuj się z nami
                      </a>
                      .
                    </AlertDescription>
                  ) : error === "invalid_token" ? (
                    <AlertDescription>
                      Token logowania jest nieprawidłowy lub wygasł. Spróbuj
                      ponownie się zalogować.
                    </AlertDescription>
                  ) : error === "usos_unavailable" ? (
                    <AlertDescription>
                      System USOS jest obecnie niedostępny. Spróbuj ponownie
                      później.
                    </AlertDescription>
                  ) : error === "authorization_failed" ? (
                    <AlertDescription>
                      Nie udało się autoryzować Twojego konta. Spróbuj ponownie
                      się zalogować.
                    </AlertDescription>
                  ) : (
                    <AlertDescription>{error}</AlertDescription>
                  )}
                </Alert>
              )}
              <p className="text-sm leading-relaxed">
                Testownik by{" "}
                <a
                  className="underline"
                  href="https://github.com/Antoni-Czaplicki"
                >
                  Antoni Czaplicki
                </a>
                , stworzony wraz ze wsparciem{" "}
                <a
                  className="underline"
                  href="https://www.facebook.com/KNKredek/"
                >
                  KN Kredek
                </a>
                .
              </p>
              <p className="flex items-center gap-1 text-sm leading-relaxed">
                Powered by{" "}
                <a
                  className="inline-flex items-center gap-1 underline"
                  href="https://solvro.pwr.edu.pl/"
                >
                  <AppLogo width={24} /> KN Solvro
                </a>
              </p>
              <p className="text-sm font-medium">
                Klikając przyciski poniżej, potwierdzasz, że zapoznałeś się z
                naszym{" "}
                <Link href={"/terms"} className="underline">
                  regulaminem
                </Link>{" "}
                oraz że go akceptujesz.
              </p>

              <div className="mb-0 grid gap-2">
                <Button asChild className="w-full">
                  <a
                    href={`${API_URL}/login/usos?jwt=true&redirect=${encodeURIComponent(currentUrl)}`}
                  >
                    Zaloguj się z USOS
                  </a>
                </Button>
                <Button asChild className="w-full">
                  <a
                    href={`${API_URL}/login?jwt=true&redirect=${encodeURIComponent(currentUrl)}`}
                  >
                    Zaloguj się z Solvro Auth
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowGuestDialog(true);
                  }}
                >
                  Kontynuuj jako gość
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="link"
                  className="text-muted-foreground text-xs hover:underline"
                  onClick={() => {
                    setShowPrivacyDialog(true);
                  }}
                >
                  Jak wykorzystujemy Twoje dane?
                </Button>
              </div>
            </CardContent>
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
            <DialogTitle>Kontynuuj jako gość</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Jeśli nie chcesz logować się za pomocą USOS, możesz kontynuować
              jako gość. W takim przypadku będziesz mógł korzystać z
              podstawowych funkcji Testownika. Wszystkie quizy oraz wyniki będą
              zapisywane lokalnie na Twoim urządzeniu (w{" "}
              <code>localStorage</code>).
            </p>
            <p>
              Jeśli zdecydujesz się na zalogowanie za pomocą USOS w przyszłości,
              będziesz mógł przenieść swoje quizy oraz wyniki do swojego konta i
              w pełni korzystać z funkcji Testownika - m.in. synchronizacji,
              udostępniania quizów oraz przeglądania swoich ocen.
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
            <Button onClick={signInAsGuest}>Kontynuuj jako gość</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
