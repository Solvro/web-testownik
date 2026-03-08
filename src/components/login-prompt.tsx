"use client";

import { IdCardLanyardIcon, LogInIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import { PrivacyDialog } from "@/components/privacy-dialog";
import { SolvroLogo } from "@/components/solvro-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { API_URL } from "@/lib/api";
import { ACCOUNT_TYPE } from "@/types/user";

function buildLoginUrl(
  base: string,
  redirectUrl: string,
  guestId?: string,
): string {
  const url = new URL(`${API_URL}${base}`);
  url.searchParams.set("jwt", "true");
  url.searchParams.set("redirect", redirectUrl);
  if (guestId !== undefined) {
    url.searchParams.set("guest_id", guestId);
  }
  return url.toString();
}

const createGuestAccount = async (): Promise<boolean> => {
  try {
    const response = await fetch("/auth/guest/create", {
      method: "POST",
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error creating guest account:", error);
    return false;
  }
};

export function LoginPrompt(): React.JSX.Element {
  const { user } = useContext(AppContext);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("/quizzes");
  const router = useRouter();

  const searchParameters = useSearchParams();

  const redirect = searchParameters.get("redirect");

  useEffect(() => {
    const url = new URL(redirect ?? "/quizzes", window.location.origin);
    setRedirectUrl(url.toString());
  }, [redirect]);

  const guestId =
    user?.account_type === ACCOUNT_TYPE.GUEST ? user.user_id : undefined;

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-lg pb-0">
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <AppLogo />
            </div>
            <CardDescription>Twoje narzędzie do nauki</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="mb-0 grid gap-2">
              <Button asChild size="lg" className="w-full">
                <a href={buildLoginUrl("/login/usos", redirectUrl, guestId)}>
                  <LogInIcon />
                  Zaloguj przez USOS
                </a>
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card text-muted-foreground px-2">
                    lub
                  </span>
                </div>
              </div>

              <Button asChild variant="outline" size="lg" className="w-full">
                <a href={buildLoginUrl("/login", redirectUrl, guestId)}>
                  <SolvroLogo width={20} />
                  Zaloguj z Solvro Auth
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  if (user?.account_type === ACCOUNT_TYPE.GUEST) {
                    router.push(redirect ?? "/quizzes");
                  } else {
                    const result = await createGuestAccount();
                    if (result) {
                      router.push(redirect ?? "/quizzes");
                    } else {
                      toast.error(
                        "Nie udało się utworzyć konta gościa. Spróbuj ponownie.",
                      );
                    }
                  }
                }}
              >
                <IdCardLanyardIcon />
                Kontynuuj jako gość
              </Button>
            </div>

            <div className="text-center">
              <Button
                variant="link"
                className="text-muted-foreground text-xs"
                onClick={() => {
                  setShowPrivacyDialog(true);
                }}
              >
                Jak wykorzystujemy Twoje dane?
              </Button>
            </div>
          </CardContent>
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-1 border-t p-4 text-center text-xs">
            <span>Powered by</span>
            <a
              className="inline-flex items-center gap-1"
              href="https://solvro.pwr.edu.pl/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <SolvroLogo width={16} /> Solvro
            </a>
            <span className="font-semibold">&</span>
            <span>created by</span>
            <a
              href="https://github.com/Antoni-Czaplicki"
              target="_blank"
              rel="noopener noreferrer"
            >
              Antoni Czaplicki
            </a>
          </div>
        </>
      </Card>

      <PrivacyDialog
        open={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
      />
    </div>
  );
}
