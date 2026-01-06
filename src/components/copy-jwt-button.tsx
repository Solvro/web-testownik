import { KeyRoundIcon } from "lucide-react";
import { useContext } from "react";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

async function copyJWTAccessToken() {
  const accessToken = localStorage.getItem("access_token");

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
  const appContext = useContext(AppContext);

  if (process.env.NODE_ENV !== "development") {
    return;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={copyJWTAccessToken}
          size="icon"
          variant="outline"
          disabled={!appContext.isAuthenticated}
          className="pointer-events-auto!"
        >
          <KeyRoundIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {appContext.isAuthenticated
          ? "Skopiuj token JWT"
          : "Zaloguj się żeby skopiować token JWT"}
      </TooltipContent>
    </Tooltip>
  );
}
