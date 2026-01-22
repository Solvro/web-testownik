"use client";

import { KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AUTH_COOKIE_NAMES, getCookie } from "@/lib/cookies";

async function copyJWTAccessToken() {
  const accessToken = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);

  if (accessToken == null) {
    toast.error("Nie znaleziono zapisanego tokenu");
    return;
  }

  try {
    await navigator.clipboard.writeText(accessToken);
    toast.success("Skopiowano token do schowka");
  } catch {
    toast.error("Nie udało się skopiować tokenu");
  }
}

interface CopyJWTAccessTokenButtonProps {
  isAuthenticated: boolean;
  isGuest: boolean;
}

export function CopyJWTAccessTokenButton({
  isAuthenticated,
  isGuest,
}: CopyJWTAccessTokenButtonProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={copyJWTAccessToken}
          size="icon"
          variant="outline"
          disabled={!isAuthenticated || isGuest}
          className="pointer-events-auto!"
        >
          <KeyRoundIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isAuthenticated && !isGuest
          ? "Skopiuj token JWT"
          : isGuest
            ? "Kopiowanie tokenu nie jest dostępne w trybie gościa"
            : "Zaloguj się żeby skopiować token JWT"}
      </TooltipContent>
    </Tooltip>
  );
}
