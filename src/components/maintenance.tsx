"use client";

import { Loader2, WrenchIcon } from "lucide-react";
import { useContext, useEffect } from "react";

import { AppContext } from "@/app-context";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function MaintenanceOverlay() {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
        const response = await fetch(`${API_URL}/status/`);
        if (response.status !== 503) {
          window.location.reload();
        }
      } catch {
        // Ignore polling errors while the backend is unreachable.
      }
    }, 30_000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-5 backdrop-blur-sm transition-all duration-300">
      <Card
        variant="gradient"
        className="border-muted w-full max-w-lg overflow-hidden text-center shadow-2xl"
      >
        <div className="bg-primary/80 h-1.5 w-full" />

        <CardHeader className="flex flex-col items-center gap-3 px-8 pt-10 pb-8">
          <div className="bg-primary/10 mb-2 flex h-20 w-20 items-center justify-center rounded-full shadow-inner">
            <WrenchIcon className="text-primary h-10 w-10" strokeWidth={1.5} />
          </div>

          <CardTitle className="text-2xl font-bold tracking-tight">
            Przerwa techniczna
          </CardTitle>

          <CardDescription className="text-base leading-relaxed">
            Testownik przechodzi właśnie krótkie prace konserwacyjne.
            Przepraszamy za utrudnienia, wrócimy do działania najszybciej jak to
            możliwe!
          </CardDescription>
        </CardHeader>

        <div className="bg-muted/30 border-muted/50 border-t px-8 py-5">
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <Loader2 className="text-primary/70 h-4 w-4 animate-spin" />
            <span>
              Automatycznie odświeżymy stronę, gdy serwery wrócą do pracy...
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function MaintenanceWrapper({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const context = useContext(AppContext);
  if (context.isMaintenance) {
    return <MaintenanceOverlay />;
  }
  return children;
}
