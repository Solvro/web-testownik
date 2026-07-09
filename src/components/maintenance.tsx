"use client";

import { WrenchIcon } from "lucide-react";
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
      } catch {}
    }, 30_000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <Card variant="gradient" className="w-2xl max-w-full p-8 text-center">
        <CardHeader className="justify-items-center gap-2">
          <WrenchIcon className="text-muted-foreground mb-2 h-11 w-11" />
          <CardTitle className="text-lg">
            Testownik jest w trakcie przerwy technicznej.
          </CardTitle>
          <CardDescription className="text-base">
            Wrócimy wkrótce!
          </CardDescription>
        </CardHeader>
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
