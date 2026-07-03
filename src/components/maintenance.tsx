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
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
        const response = await fetch(`${API_URL}/status/`);
        if (response.status !== 503) {
          window.location.reload();
        }
      } catch (error) {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center p-5">
      <Card variant="gradient" className="max-w-full w-2xl text-center p-8">
        <CardHeader className="justify-items-center gap-2">
          <WrenchIcon className="mb-2 h-11 w-11 text-muted-foreground" />
          <CardTitle className="text-lg">Testownik jest w trakcie przerwy technicznej.</CardTitle>
          <CardDescription className="text-md">Wrócimy wkrótce!</CardDescription>
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
