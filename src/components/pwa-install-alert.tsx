"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useIsPwaInstallTarget } from "@/hooks/use-is-pwa-install-target";
import { useIsStandalone } from "@/hooks/use-is-standalone";

const PWA_INSTALL_ALERT_DISMISSED_KEY = "pwa-install-alert-dismissed";

function readIsDismissed() {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(PWA_INSTALL_ALERT_DISMISSED_KEY) === "true";
}

export function PwaInstallAlert() {
  const [isDismissed, setIsDismissed] = useState(readIsDismissed);
  const isInstallTarget = useIsPwaInstallTarget();
  const isStandalone = useIsStandalone();
  const searchParams = useSearchParams();
  const forceInstall = searchParams.get("install") === "true";

  const handleDismiss = () => {
    localStorage.setItem(PWA_INSTALL_ALERT_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (isStandalone || (!forceInstall && (isDismissed || !isInstallTarget))) {
    return null;
  }

  return (
    <PwaInstallPrompt onDismiss={handleDismiss}>
      <Alert className="mt-2">
        <DownloadIcon />
        <AlertTitle className="flex items-center justify-between gap-2 font-semibold">
          Zainstaluj aplikację
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zamknij"
            className="text-current"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDismiss();
            }}
          >
            <XIcon className="size-4" />
          </Button>
        </AlertTitle>
        <AlertDescription>
          Miej Testownik zawsze pod ręką — także offline.
        </AlertDescription>
      </Alert>
    </PwaInstallPrompt>
  );
}
