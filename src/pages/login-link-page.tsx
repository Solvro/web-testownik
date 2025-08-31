import type { AxiosError } from "axios";
import axios from "axios";
import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import Loader from "@/components/loader.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import AppContext from "../app-context.tsx";
import { SERVER_URL } from "../config.ts";

function LoginLinkPage() {
  const { token } = useParams<{ token: string }>();
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  document.title = "Logowanie OTP - Testownik Solvro";

  const handleLogin = useCallback(async () => {
    try {
      const response = await axios.post(`${SERVER_URL}/login-link/`, { token });
      if (response.status === 200) {
        localStorage.setItem("access_token", response.data.access_token);
        localStorage.setItem("refresh_token", response.data.refresh_token);
        await appContext.fetchUserData();
        appContext.setAuthenticated(true);
        appContext.setGuest(false);
        navigate("/");
      } else {
        setError(response.statusText);
      }
    } catch (error) {
      setError(
        (
          (error as AxiosError)?.response?.data as {
            error?: string;
          }
        )?.error || "Niezidentyfikowany błąd.",
      );
    }
  }, [token]);

  useEffect(() => {
    handleLogin();
  }, [handleLogin]);

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="space-y-2">
              <AlertDescription className="space-y-2">
                <p>Wystąpił błąd podczas logowania za pomocą linku.</p>
                <p>{error}</p>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Wyślij ponownie link
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4 text-center">
              <p>Trwa logowanie...</p>
              <Loader loading={true} size={15} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginLinkPage;
