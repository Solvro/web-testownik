import { REGEXP_ONLY_DIGITS } from "input-otp";
import React, { useCallback, useContext, useState } from "react";
import { useNavigate } from "react-router";

import { AppContext } from "@/app-context.ts";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp.tsx";
import { Label } from "@/components/ui/label.tsx";

export function OTPLoginPage() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");

  document.title = "Logowanie OTP - Testownik Solvro";

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await appContext.services.user.generateOTP(email);
      setSubmitted(true);
      setError(null);
    } catch (error_) {
      const apiError = error_ as Error;
      if (apiError.message.includes("404")) {
        setError("Nie znaleziono użytkownika o podanym adresie e-mail.");
      } else {
        setError("Niezidentyfikowany błąd.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOTPSubmit = useCallback(
    async (event_: React.FormEvent<HTMLFormElement>) => {
      event_.preventDefault();
      if (submitting) {
        return;
      }
      setSubmitting(true);
      try {
        const data = await appContext.services.user.verifyOTP(
          email.trim(),
          otp,
        );
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        localStorage.setItem(
          "access_token_expires_at",
          (Date.now() + 3600 * 1000).toString(),
        );
        const user = await appContext.services.user.getUserData();
        appContext.services.user.storeUserData(user);
        appContext.setAuthenticated(true);
        appContext.setGuest(false);
        await navigate("/");
      } catch {
        setError("Niezidentyfikowany błąd.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, otp, appContext, navigate, submitting],
  );

  if (submitted) {
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
              onSubmit={handleOTPSubmit}
              className="flex flex-col items-center"
            >
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
            {error != null && (
              <Alert variant="destructive" className="mt-4 space-y-2">
                <AlertDescription>
                  <p>
                    Wystąpił błąd podczas logowania za pomocą kodu
                    jednorazowego.
                  </p>
                  <p>{error}</p>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => {
                      setSubmitted(false);
                      setError(null);
                      setOtp("");
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
          {error != null && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                <p>Wystąpił błąd podczas wysyłania kodu.</p>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
