"use client";

import { LogInIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_URL } from "@/lib/api";

export function LoginPrompt(): React.JSX.Element {
  const [redirectUrl, setRedirectUrl] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
    setRedirectUrl(window.location.href);
  }, []);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Wymagane logowanie</h3>
          <p className="text-muted-foreground text-sm">
            Musisz być zalogowany, aby uzyskać dostęp do tej zawartości.
          </p>
        </div>
        <Button asChild>
          <a href={`${API_URL}/login/usos?jwt=true&redirect=${redirectUrl}`}>
            <LogInIcon className="mr-2 size-4" />
            Zaloguj się
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
