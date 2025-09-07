import type { AxiosError } from "axios";
import axios from "axios";
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
import { SERVER_URL } from "@/config.ts";

export function OTPLoginPage() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");

  document.title = "Logowanie OTP - Testownik Solvro";

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const response = await axios.post(`${SERVER_URL}/generate-otp/`, {
        email,
      });
      if (response.status === 200) {
        setSubmitted(true);
        setError(null);
      } else {
        setError(response.statusText);
      }
    } catch (error_) {
      if ((error_ as AxiosError).response?.status === 404) {
        setError("Nie znaleziono użytkownika o podanym adresie e-mail.");
      } else {
        setError(
          (
            (error_ as AxiosError).response?.data as {
              error?: string;
            }
          ).error ?? "Niezidentyfikowany błąd.",
        );
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
        const response = await axios.post(`${SERVER_URL}/login-otp/`, {
          email: email.trim(),
          otp,
        });
        if (response.status === 200) {
          localStorage.setItem("access_token", response.data.access_token);
          localStorage.setItem("refresh_token", response.data.refresh_token);
          await appContext.fetchUserData();
          appContext.setAuthenticated(true);
          appContext.setGuest(false);
          await navigate("/");
        } else {
          setError(response.statusText);
        }
      } catch (error_) {
        setError(
          (
            (error_ as AxiosError).response?.data as {
              error?: string;
            }
          ).error ?? "Niezidentyfikowany błąd.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [email, otp],
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
