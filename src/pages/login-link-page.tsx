import type { AxiosError } from "axios";
import axios from "axios";
import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AppContext } from "@/app-context.ts";
import { Loader } from "@/components/loader.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SERVER_URL } from "@/config.ts";

export function LoginLinkPage() {
  const { token } = useParams<{ token: string }>();
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  document.title = "Logowanie OTP - Testownik Solvro";

  const handleLogin = useCallback(async () => {
    try {
      const response = await axios.post(`${SERVER_URL}/login-link/`, { token });
      if (response.status === 200) {
        const data = response.data as {
          access_token: string;
          refresh_token: string;
        };
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        await appContext.fetchUserData();
        appContext.setAuthenticated(true);
        appContext.setGuest(false);
        void navigate("/");
      } else {
        setError(response.statusText);
      }
    } catch (loginError) {
      const errorData = (loginError as AxiosError).response?.data as
        | { error?: string }
        | undefined;
      setError(errorData?.error ?? "Niezidentyfikowany błąd.");
    }
  }, [token, appContext, navigate]);

  useEffect(() => {
    void handleLogin();
  }, [handleLogin]);

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent>
          {error == null ? (
            <div className="space-y-4 text-center">
              <p>Trwa logowanie...</p>
              <Loader loading={true} size={15} />
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
