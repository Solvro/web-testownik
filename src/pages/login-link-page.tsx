import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AppContext } from "@/app-context.ts";
import { Loader } from "@/components/loader.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoginLinkPage() {
  const { token } = useParams<{ token: string }>();
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  document.title = "Logowanie OTP - Testownik Solvro";

  const handleLogin = useCallback(async () => {
    if (token === undefined || token.trim() === "") {
      setError("Brak tokenu logowania.");
      return;
    }
    try {
      const data = await appContext.services.user.loginWithLink(token);
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
      void navigate("/");
    } catch {
      setError("Niezidentyfikowany błąd.");
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
