"use client";

import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

function getErrorMessage(errorCode: string | undefined): string | null {
  switch (errorCode) {
    case "invalid_otp": {
      return "Kod jest nieprawidłowy lub wygasł. Spróbuj ponownie.";
    }
    case "missing_otp": {
      return "Brak kodu. Wprowadź 6-cyfrowy kod.";
    }
    case "guest_auth_required": {
      return "Nie można potwierdzić konta gościa. Twoje dane pozostają zapisane. Odśwież sesję i spróbuj ponownie.";
    }
    case "guest_migration_failed": {
      return "Nie udało się przenieść danych gościa. Dane i kod nie zostały usunięte. Spróbuj ponownie.";
    }
    case "server_error": {
      return "Wystąpił błąd serwera. Spróbuj ponownie.";
    }
    case undefined:
    default: {
      return null;
    }
  }
}

interface LoginOTPCodeClientProps {
  email: string;
  error?: string;
}

export function LoginOTPCodeClient({ email, error }: LoginOTPCodeClientProps) {
  const appContext = useContext(AppContext);
  const router = useRouter();
  const [otp, setOtp] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    if (submitting || otp.length < 6) {
      event.preventDefault();
      return;
    }
    setSubmitting(true);
  };

  const errorMessage = getErrorMessage(error);
  const guestId =
    appContext.user?.account_type === ACCOUNT_TYPE.GUEST
      ? appContext.user.user_id
      : undefined;

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Kod jednorazowy został wysłany</CardTitle>
          <CardDescription>
            Sprawdź swoją skrzynkę i wprowadź kod poniżej
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action="/auth/login-otp"
            method="POST"
            onSubmit={handleSubmit}
            className="flex flex-col items-center"
          >
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="otp" value={otp} />
            {guestId !== undefined && (
              <input type="hidden" name="guest_id" value={guestId} />
            )}
            <Label className="mb-2 text-sm font-medium" htmlFor="otp">
              Wprowadź kod jednorazowy
            </Label>
            <InputOTP
              id="otp"
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
              }}
              pattern={REGEXP_ONLY_DIGITS}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              type="submit"
              disabled={submitting || otp.length < 6}
              className="mt-6 w-full"
            >
              {submitting ? "Logowanie..." : "Zaloguj się"}
            </Button>
          </form>
          {errorMessage != null && (
            <Alert variant="destructive" className="mt-4 space-y-2">
              <AlertDescription>
                <p>
                  Wystąpił błąd podczas logowania za pomocą kodu jednorazowego.
                </p>
                <p>{errorMessage}</p>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    router.push("/login-otp");
                  }}
                >
                  Wyślij ponownie kod
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
