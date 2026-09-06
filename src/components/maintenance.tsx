"use client";

import { ConstructionIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import { Button } from "./ui/button";

function MaintenanceOverlay() {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
        const response = await fetch(`${API_URL}/status/`);
        if (response.ok) {
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
    <div className="flex flex-1 items-center justify-center p-5">
      <Empty className="w-full max-w-xl overflow-hidden text-center">
        <div className="w-full" />

        <EmptyHeader className="flex flex-col items-center">
          <div className="flex w-20 items-center justify-center">
            <ConstructionIcon className="h-10 w-10" strokeWidth={1} />
          </div>

          <EmptyTitle className="text-3xl font-bold tracking-tight">
            Przerwa techniczna
          </EmptyTitle>

          <EmptyDescription className="text-foreground/80 text-sm leading-relaxed">
            Trwają prace techniczne nad Testownikiem Solvro. <br />
            Wróć za chwilę - wkrótce będziemy ponownie dostępni.
          </EmptyDescription>
        </EmptyHeader>

        <div>
          <div className="flex items-center justify-center text-sm">
            <Button
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
            >
              Odśwież stronę
            </Button>
          </div>
        </div>
      </Empty>
    </div>
  );
}

export function MaintenanceWrapper({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    const handleMaintenance = () => {
      setIsMaintenance(true);
    };
    window.addEventListener("backend-maintenance", handleMaintenance);
    return () => {
      window.removeEventListener("backend-maintenance", handleMaintenance);
    };
  }, []);

  if (isMaintenance) {
    return <MaintenanceOverlay />;
  }
  return children;
}
