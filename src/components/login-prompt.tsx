import React, { useContext, useState } from "react";
import { Link, useLocation } from "react-router";

import { AppContext } from "@/app-context.tsx";
import { AppLogo } from "@/components/app-logo.tsx";
import { Loader } from "@/components/loader.tsx";
import { PrivacyModal } from "@/components/privacy-modal.tsx";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SERVER_URL } from "@/config.ts";

export function LoginPrompt(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const location = useLocation();
  const queryParameters = new URLSearchParams(location.search);
  const accessToken = queryParameters.get("access_token");
  const refreshToken = queryParameters.get("refresh_token");
  const error = queryParameters.get("error");

  const signInAsGuest = () => {
    appContext.setGuest(true);
    setShowGuestModal(false);
    localStorage.setItem(
      "settings",
      JSON.stringify({
        ...(localStorage.getItem("settings")
          ? JSON.parse(localStorage.getItem("settings")!)
          : {}),
        sync_progress: false,
      }),
    );
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-xl min-w-1/2 pb-2">
        {accessToken && refreshToken ? (
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
              {error ? (
                <Alert variant="destructive" className="text-sm">
                  <p className="font-medium">
                    Wystąpił błąd podczas logowania.
                  </p>
                  {error === "not_student" ? (
                    <span>
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
                    </span>
                  ) : (
                    <span>{error}</span>
                  )}
                </Alert>
              ) : null}
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
                <Link to={"/terms"} className="underline">
                  regulaminem
                </Link>{" "}
                oraz że go akceptujesz.
              </p>
              <div className="mb-0 grid gap-2">
                <Button asChild className="w-full">
                  <a
                    href={`${SERVER_URL}/login/usos?jwt=true&redirect=${String(document.location)}`}
                  >
                    Zaloguj się z USOS
                  </a>
                </Button>
                <Button asChild className="w-full">
                  <a
                    href={`${SERVER_URL}/login?jwt=true&redirect=${String(document.location)}`}
                  >
                    Zaloguj się z Solvro Auth
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowGuestModal(true);
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
                    setShowPrivacyModal(true);
                  }}
                >
                  Jak wykorzystujemy Twoje dane?
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
      <PrivacyModal
        show={showPrivacyModal}
        onHide={() => {
          setShowPrivacyModal(false);
        }}
      />
      <Dialog
        open={showGuestModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowGuestModal(false);
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
              <code>localStorage</code> ).
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
                setShowGuestModal(false);
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
