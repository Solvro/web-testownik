import { RefreshCwIcon, WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

// Wersja online trasy /offline (pełny layout aplikacji).
// Service worker serwuje public/offline.html jako fallback offline.

export const metadata: Metadata = {
  title: "Brak połączenia",
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
        <WifiOffIcon className="text-muted-foreground size-12" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Brak połączenia z internetem
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Testownik wymaga połączenia z siecią. Sprawdź połączenie i spróbuj
            ponownie.
          </p>
        </div>
        <Link
          href="/"
          className="bg-input hover:bg-accent-input dark:hover:bg-ring inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border px-4 py-2.5 text-base font-normal dark:border-0"
        >
          <RefreshCwIcon className="size-4" />
          Spróbuj ponownie
        </Link>
      </CardContent>
    </Card>
  );
}
