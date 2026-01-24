"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getUrlErrorMessage(errorCode: string | null): string | null {
  switch (errorCode) {
    case "missing_email": {
      return "Brak adresu e-mail. Wprowadź swój adres e-mail.";
    }
    case null:
    default: {
      return null;
    }
  }
}

export function LoginOTPPageClient() {
  const appContext = useContext(AppContext);
  const router = useRouter();
  const urlSearchParameters = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  const urlError = urlSearchParameters.get("error");

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await appContext.services.user.generateOTP(email);
      setError(null);
      // Redirect to code entry page
      router.push(`/login-otp/code?email=${encodeURIComponent(email.trim())}`);
    } catch (error_) {
      const apiError = error_ as Error;
      if (apiError.message.includes("404")) {
        setError("Nie znaleziono użytkownika o podanym adresie e-mail.");
      } else {
        setError("Niezidentyfikowany błąd.");
      }
      setSubmitting(false);
    }
  };

  const urlErrorMessage = getUrlErrorMessage(urlError);

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Zaloguj się za pomocą adresu e-mail</CardTitle>
          <CardDescription>
            Na Twój adres e-mail zostanie wysłany kod jednorazowy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(event_) => {
                  setEmail(event_.target.value);
                }}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Wysyłanie..." : "Wyślij kod"}
            </Button>
          </form>
          {(error != null || urlErrorMessage != null) && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                <p>Wystąpił błąd podczas wysyłania kodu.</p>
                <p>{error ?? urlErrorMessage}</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
