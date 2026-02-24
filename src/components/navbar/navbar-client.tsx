"use client";

import Link from "next/link";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import type { JWTPayload } from "@/lib/auth/types";

import { AuthButtons } from "./auth-buttons";
import { MobileMenu } from "./mobile-menu";
import { MobileMenuButton } from "./mobile-menu-button";
import { NavLinks } from "./nav-links";
import { NavbarActions } from "./navbar-actions";

interface NavbarClientProps {
  initialUser: JWTPayload | null;
  initialIsGuest: boolean;
}

export function NavbarClient({
  initialUser,
  initialIsGuest,
}: NavbarClientProps) {
  const { isGuest, user } = useContext(AppContext);

  const [expanded, setExpanded] = useState(false);

  // Use SSR initial values, with client-side context as fallback after hydration
  const isGuestMode = isGuest || initialIsGuest;

  const activeUser = user ?? (user === undefined ? initialUser : null);
  const isAuthenticated = activeUser !== null;
  const isStaff = activeUser?.is_staff ?? false;
  const profilePicture = activeUser?.photo ?? null;

  return (
    <nav className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-4 sm:px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <AppLogo />
          </Link>
          <NavLinks isStaff={isStaff} variant="desktop" />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NavbarActions
            isAuthenticated={isAuthenticated}
            isGuest={isGuestMode}
          />
          <AuthButtons
            isAuthenticated={isAuthenticated}
            isGuest={isGuestMode}
            profilePicture={profilePicture}
          />
        </div>
        <MobileMenuButton
          expanded={expanded}
          onToggle={() => {
            setExpanded(!expanded);
          }}
        />
      </div>
      {expanded ? (
        <MobileMenu
          isAuthenticated={isAuthenticated}
          isGuest={isGuestMode}
          isStaff={isStaff}
          profilePicture={profilePicture}
        />
      ) : null}
    </nav>
  );
}
