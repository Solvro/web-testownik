import { Icon } from "@iconify/react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { CrownIcon } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeviceMetadata {
  device: string;
  type: string;
}

interface PeerConnectionWithMetadata {
  metadata?: DeviceMetadata;
  [key: string]: unknown;
}

interface ContinuityModalProps {
  peerConnections: PeerConnectionWithMetadata[];
  isContinuityHost: boolean;
}

const ContinuityModal: React.FC<ContinuityModalProps> = ({
  peerConnections,
  isContinuityHost,
}) => {
  const connectedDevices = peerConnections
    .map((c) => c.metadata?.device ?? "Unknown")
    .join(", ")
    .replace(/,([^,]*)$/, " i$1");
  const iconName =
    peerConnections.length === 1
      ? getIconByDevice(peerConnections[0]?.metadata?.type ?? "unknown")
      : "flat-color-icons:multiple-devices";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className={`fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full p-0 shadow-lg ${peerConnections.length === 0 ? "hidden" : ""}`}
          variant="outline"
        >
          <span className="relative inline-flex h-full w-full items-center justify-center">
            <Icon icon={iconName} className="text-xl" />
            {isContinuityHost ? (
              <span className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white shadow">
                <CrownIcon className="size-3" />
              </span>
            ) : null}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Continuity</DialogTitle>
          <DialogDescription>
            {peerConnections.length === 0 ? (
              <span>
                Zaloguj się na obu urządzeniach i otwórz ten quiz, aby się
                połączyć.
              </span>
            ) : (
              <span>
                Połączono z {connectedDevices}
                <br />
                Synchronizujesz swój postęp na żywo.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DotLottieReact
          src="https://lottie.host/25909953-1714-4638-921c-a7b94593bae2/k3okRjUxg9.json"
          loop
          autoplay
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Zamknij</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const getIconByDevice = (type: string) => {
  switch (type) {
    case "desktop": {
      return "fluent-emoji:desktop-computer";
    }
    case "tablet": {
      return "flat-color-icons:tablet-android";
    }
    case "mobile": {
      return "flat-color-icons:phone-android";
    }
    default: {
      return "flat-color-icons:multiple-devices";
    }
  }
};

export default ContinuityModal;
