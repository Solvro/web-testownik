"use client";

import Link from "next/link";
import { useContext, useLayoutEffect, useState } from "react";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import { API_URL } from "@/lib/api";
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
  const [loginUrl, setLoginUrl] = useState(`${API_URL}/login/usos?jwt=true`);

  // Use SSR initial values, with client-side context as fallback after hydration
  const isGuestMode = isGuest || initialIsGuest;

  const activeUser = user ?? initialUser;
  const isAuthenticated = activeUser !== null || isGuestMode;
  const isStaff = activeUser?.is_staff ?? false;
  const profilePicture = activeUser?.photo ?? null;

  useLayoutEffect(() => {
    setLoginUrl(
      `${API_URL}/login/usos?jwt=true&redirect=${window.location.href}`,
    );
  }, []);

  return (
    <nav className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-4 sm:px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <AppLogo width={40} />
          </Link>
          <NavLinks isStaff={isStaff} variant="desktop" />
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <NavbarActions
            isAuthenticated={isAuthenticated}
            isGuest={isGuestMode}
          />
          <AuthButtons
            isAuthenticated={initialUser !== null}
            isGuest={isGuestMode}
            profilePicture={profilePicture}
            loginUrl={loginUrl}
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
          isAuthenticated={initialUser !== null}
          isGuest={isGuestMode}
          isStaff={isStaff}
          profilePicture={profilePicture}
          loginUrl={loginUrl}
        />
      ) : null}
    </nav>
  );
}
