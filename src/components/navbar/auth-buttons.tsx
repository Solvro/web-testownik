"use client";

import {
  CircleUserRoundIcon,
  IdCardLanyardIcon,
  LogInIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE } from "@/types/user";

import { LogoutButton } from "./logout-button";

export function AuthButtons() {
  const { isAuthenticated, user } = useContext(AppContext);
  const isGuest = user?.account_type === ACCOUNT_TYPE.GUEST;
  const isGold = user?.account_level === "gold";
  const profilePicture = user?.photo;

  const pathname = usePathname();
  const loginHref =
    pathname === "/" || pathname === "/login"
      ? "/login"
      : `/login?redirect=${encodeURIComponent(pathname)}`;

  if (isGuest) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="relative" asChild>
              <Link href="/profile">
                <IdCardLanyardIcon />
                <div className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-500" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Korzystasz z konta gościa
          </TooltipContent>
        </Tooltip>

        <Button asChild>
          <Link href={loginHref}>
            <LogInIcon />
            Zaloguj się
          </Link>
        </Button>
      </>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <Button
          className={cn(
            isGold
              ? "border border-amber-300/70 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-950 shadow-[0_8px_22px_-14px_rgba(217,119,6,0.95)] transition-all hover:from-amber-300 hover:via-yellow-200 hover:to-amber-300"
              : null,
          )}
          asChild
        >
          <Link href="/profile">
            {profilePicture === null ? (
              <span
                className={
                  isGold
                    ? "ring-offset-background relative inline-flex rounded-full ring-2 ring-amber-400/85 ring-offset-1"
                    : "relative inline-flex"
                }
              >
                <CircleUserRoundIcon className="size-6" />
              </span>
            ) : (
              <span className="relative inline-flex">
                <Avatar
                  className={
                    isGold
                      ? "ring-offset-background size-6 ring-2 ring-amber-400/85 ring-offset-1"
                      : "size-6"
                  }
                >
                  <AvatarImage
                    src={profilePicture}
                    className="user-avatar"
                    alt="Zdjęcie profilowe użytkownika"
                  />
                  <AvatarFallback delayMs={600} className="bg-transparent">
                    <CircleUserRoundIcon className="size-6" />
                  </AvatarFallback>
                </Avatar>
              </span>
            )}
            <span>Profil</span>
          </Link>
        </Button>
        <LogoutButton />
      </>
    );
  }

  return (
    <Button asChild>
      <Link href={loginHref}>
        <LogInIcon />
        Zaloguj się
      </Link>
    </Button>
  );
}
