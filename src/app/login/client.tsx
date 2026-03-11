"use client";

import { LogInIcon } from "lucide-react";
import Link from "next/link";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { LoginPrompt } from "@/components/login-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACCOUNT_TYPE } from "@/types/user";

export function LoginPageClient() {
  const { user } = useContext(AppContext);

  const isAuthenticated = user != null;
  const isGuest = user?.account_type === ACCOUNT_TYPE.GUEST;

  if (!isGuest && isAuthenticated) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <LogInIcon className="text-primary h-8 w-8" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Jesteś już zalogowany</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Masz już aktywne konto. Przejdź do strony głównej, aby korzystać z
              Testownika.
            </p>
            <Button
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/">
                  Strona główna
                </Link>
              )}
            ></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LoginPrompt />;
}
