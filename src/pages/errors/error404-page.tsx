import React from "react";

import { Card, CardContent } from "@/components/ui/card";

export function Error404Page(): React.JSX.Element {
  document.title = "404 - Testownik Solvro";

  return (
    <div className="flex justify-center">
      <Card>
        <CardContent className="space-y-2 text-center">
          <h1 className="text-5xl font-bold">404</h1>
          <h2 className="text-2xl font-semibold">
            Strona nie została znaleziona
          </h2>

          <p className="text-muted-foreground">
            Jeśli uważasz, że to błąd, możesz utworzyć zgłoszenie na{" "}
            <a
              href="https://github.com/solvro/web-testownik/issues"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              GitHubie
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
