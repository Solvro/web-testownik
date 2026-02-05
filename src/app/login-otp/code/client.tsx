"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const router = useRouter();
  const [otp, setOtp] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || otp.length < 6) {
      return;
    }
    setSubmitting(true);
    router.push(
      `/auth/login-otp?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`,
    );
    setTimeout(() => {
      setSubmitting(false);
    }, 1000);
  };

  const errorMessage = getErrorMessage(error);

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
          <form onSubmit={handleSubmit} className="flex flex-col items-center">
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
