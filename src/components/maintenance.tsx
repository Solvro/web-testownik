"use client";

import { WrenchIcon } from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function MaintenanceOverlay() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Empty className="border-none shadow-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WrenchIcon className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Testownik jest w trakcie przerwy technicznej</EmptyTitle>
          <EmptyDescription>Wrócimy wkrótce!</EmptyDescription>
        </EmptyHeader>
      </Empty>
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
