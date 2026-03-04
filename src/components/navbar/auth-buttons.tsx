"use client";

import {
  CircleUserRoundIcon,
  CloudUploadIcon,
  IdCardLanyardIcon,
  LogInIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { API_URL } from "@/lib/api";

export interface AuthButtonsProps {
  isAuthenticated: boolean;
  isGuest: boolean;
  profilePicture: string | null;
}

export function AuthButtons({
  isAuthenticated,
  isGuest,
  profilePicture,
}: AuthButtonsProps) {
  const [currentUrl, setCurrentUrl] = useState("/");
  const searchParameters = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const redirect = searchParameters.get("redirect");
    const url = new URL(redirect ?? pathname, window.location.origin);
    setCurrentUrl(url.toString());
  }, [pathname, searchParameters]);

  if (isGuest) {
    return (
      <>
        <Button
          nativeButton={false}
          render={(props) => (
            <Link {...props} href="/profile">
              <IdCardLanyardIcon />
              <span>Gość</span>
            </Link>
          )}
        ></Button>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="p-2"
                nativeButton={false}
                render={(props) => (
                  <Link {...props} href="/connect-account">
                    <CloudUploadIcon />
                  </Link>
                )}
              ></Button>
            }
          ></TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Połącz konto</p>
          </TooltipContent>
        </Tooltip>
      </>
    );
  }

  if (isAuthenticated) {
    return (
      <Button
        variant="cta"
        nativeButton={false}
        render={(props) => (
          <Link {...props} href="/profile">
            {profilePicture === null ? (
              <CircleUserRoundIcon className="size-6" />
            ) : (
              <Avatar className="size-6">
                <AvatarImage src={profilePicture} className="user-avatar" />
                <AvatarFallback delay={600} className="bg-transparent">
                  <CircleUserRoundIcon className="size-6" />
                </AvatarFallback>
              </Avatar>
            )}
            <span>Profil</span>
          </Link>
        )}
      ></Button>
    );
  }

  return (
    <Button
      nativeButton={false}
      render={(props) => (
        <Link
          {...props}
          href={`${API_URL}/login/usos?jwt=true&redirect=${encodeURIComponent(
            currentUrl,
          )}`}
        >
          <LogInIcon />
          Zaloguj się
        </Link>
      )}
    ></Button>
  );
}
