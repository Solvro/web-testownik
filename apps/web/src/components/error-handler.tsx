"use client";

import { AlertCircleIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useContext } from "react";

import { AppContext } from "@/app-context";
import { BannedScreen } from "@/components/banned-screen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

export function ErrorHandler(): React.JSX.Element | null {
  const { user } = useContext(AppContext);
  const searchParameters = useSearchParams();

  const error = searchParameters.get("error");
  const banReason =
    searchParameters.get("ban_reason") ?? searchParameters.get("reason");

  const isBannedByUrl = error === "user_banned";
  const isBannedByUserState = user?.is_banned === true;

  if (isBannedByUrl || isBannedByUserState) {
    return <BannedScreen reason={banReason ?? undefined} />;
  }

  if (error !== null && error !== "") {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Błąd logowania</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
