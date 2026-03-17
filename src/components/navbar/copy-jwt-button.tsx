"use client";

import { KeyRoundIcon } from "lucide-react";
import { useContext } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
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
export function CopyJWTAccessTokenButton() {
  const { isAuthenticated } = useContext(AppContext);

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
          disabled={!isAuthenticated}
          className="pointer-events-auto!"
          aria-label="Skopiuj token JWT"
        >
          <KeyRoundIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isAuthenticated
          ? "Skopiuj token JWT"
          : "Zaloguj się żeby skopiować token JWT"}
      </TooltipContent>
    </Tooltip>
  );
}
