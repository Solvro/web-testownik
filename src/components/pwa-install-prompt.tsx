"use client";

import { ShareIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsStandalone } from "@/hooks/use-is-standalone";
import { getPwaPlatform, isIosDevice } from "@/lib/pwa/device";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

interface PwaInstallPromptProps {
  children: ReactNode;
  onDismiss?: () => void;
}

export function PwaInstallPrompt({
  children,
  onDismiss,
}: PwaInstallPromptProps) {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isFallbackInstructionsOpen, setIsFallbackInstructionsOpen] =
    useState(false);
  const [isAutoInstallModalOpen, setIsAutoInstallModalOpen] = useState(false);
  const installTriggered = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const isStandalone = useIsStandalone();
  const [platform, setPlatform] = useState<ReturnType<
    typeof getPwaPlatform
  > | null>(null);

  useEffect(() => {
    setPlatform(getPwaPlatform());
  }, []);

  const isIos = platform?.isIos ?? isIosDevice();
  const isMacSafari = platform?.isMacSafari ?? false;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const clearInstallQuery = useCallback(() => {
    if (searchParameters.get("install") !== "true") {
      return;
    }

    const nextParameters = new URLSearchParams(searchParameters.toString());
    nextParameters.delete("install");

    const nextUrl =
      nextParameters.size > 0
        ? `${pathname}?${nextParameters.toString()}`
        : pathname;

    router.replace(nextUrl);
  }, [pathname, router, searchParameters]);

  const handleInstallClick = useCallback(async () => {
    if (isStandalone) {
      return;
    }

    if (installPromptEvent !== null) {
      await installPromptEvent.prompt();
      clearInstallQuery();
      return;
    }

    if (isIos || isMacSafari) {
      setIsInstructionsOpen(true);
      return;
    }

    setIsFallbackInstructionsOpen(true);
  }, [clearInstallQuery, installPromptEvent, isIos, isMacSafari, isStandalone]);

  const handleAutoInstall = async () => {
    await handleInstallClick();
    setIsAutoInstallModalOpen(false);
    onDismiss?.();
    clearInstallQuery();
  };

  useEffect(() => {
    if (
      searchParameters.get("install") === "true" &&
      !installTriggered.current &&
      (installPromptEvent !== null || isIos || isMacSafari)
    ) {
      setIsAutoInstallModalOpen(true);
      installTriggered.current = true;
    }
  }, [installPromptEvent, isIos, isMacSafari, searchParameters]);

  const iosInstructions = (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>
        Naciśnij przycisk udostępniania{" "}
        <ShareIcon className="inline size-4 align-text-bottom" /> w pasku
        nawigacyjnym Safari.
      </li>
      <li>Przewiń w dół i wybierz „Dodaj do ekranu początkowego”.</li>
      <li>Potwierdź, naciskając „Dodaj” w prawym górnym rogu.</li>
    </ol>
  );

  const macSafariInstructions = (
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>
        W Safari kliknij przycisk udostępniania{" "}
        <ShareIcon className="inline size-4 align-text-bottom" /> na pasku
        narzędzi.
      </li>
      <li>Wybierz „Dodaj do Docka”.</li>
      <li>Możesz zmienić nazwę aplikacji, a następnie kliknij „Dodaj”.</li>
    </ol>
  );

  const instructions = isIos ? iosInstructions : macSafariInstructions;
  const instructionTitle = isIos ? "Instalacja na iOS" : "Instalacja na macOS";

  const closeInstructions = () => {
    setIsInstructionsOpen(false);
    onDismiss?.();
    clearInstallQuery();
  };

  const closeFallback = () => {
    setIsFallbackInstructionsOpen(false);
    onDismiss?.();
    clearInstallQuery();
  };

  return (
    <>
      <div
        className="cursor-pointer"
        onClick={() => {
          void handleInstallClick();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void handleInstallClick();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {children}
      </div>

      <Dialog
        open={isAutoInstallModalOpen}
        onOpenChange={(open) => {
          setIsAutoInstallModalOpen(open);
          if (!open) {
            onDismiss?.();
            clearInstallQuery();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zainstaluj Testownik</DialogTitle>
            <DialogDescription>
              Dodaj aplikację na urządzenie, aby mieć szybki dostęp i korzystać
              z niej także offline.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => void handleAutoInstall()}>Zainstaluj</Button>
            <DialogClose render={<Button variant="outline" />}>
              Anuluj
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isIos || isMacSafari ? (
        <Dialog
          open={isInstructionsOpen}
          onOpenChange={(open) => {
            setIsInstructionsOpen(open);
            if (!open) {
              closeInstructions();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{instructionTitle}</DialogTitle>
              <div className="text-muted-foreground text-sm">
                {instructions}
              </div>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Zamknij
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={isFallbackInstructionsOpen}
        onOpenChange={(open) => {
          setIsFallbackInstructionsOpen(open);
          if (!open) {
            closeFallback();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalacja aplikacji</DialogTitle>
            <DialogDescription>
              Poszukaj opcji „Zainstaluj aplikację” lub „Dodaj do ekranu
              początkowego” w menu przeglądarki. Jeśli aplikacja jest już
              zainstalowana, otwórz ją z ekranu głównego lub paska aplikacji.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Zamknij
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
