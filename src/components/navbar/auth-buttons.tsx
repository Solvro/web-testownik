"use client";

import {
  CircleUserRoundIcon,
  CloudUploadIcon,
  IdCardLanyardIcon,
  LogInIcon,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { LogoutButton } from "./logout-button";

export interface AuthButtonsProps {
  isAuthenticated: boolean;
  isGuest: boolean;
  profilePicture: string | null;
  loginUrl: string;
}

export function AuthButtons({
  isAuthenticated,
  isGuest,
  profilePicture,
  loginUrl,
}: AuthButtonsProps) {
  if (isGuest) {
    return (
      <>
        <Button asChild>
          <Link href="/profile">
            <IdCardLanyardIcon />
            <span>Gość</span>
          </Link>
        </Button>
        <Button variant="outline" size="icon" className="p-2" asChild>
          <Link href="/connect-account">
            <CloudUploadIcon />
          </Link>
        </Button>
      </>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <Button asChild>
          <Link href="/profile">
            {profilePicture === null ? (
              <CircleUserRoundIcon className="size-6" />
            ) : (
              <Avatar className="size-6">
                <AvatarImage src={profilePicture} className="user-avatar" />
                <AvatarFallback delayMs={600} className="bg-transparent">
                  <CircleUserRoundIcon className="size-6" />
                </AvatarFallback>
              </Avatar>
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
      <a href={loginUrl}>
        <LogInIcon />
        Zaloguj się
      </a>
    </Button>
  );
}
