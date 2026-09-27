"use client";

import Link from "next/link";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import { AuthButtons } from "@/components/navbar/auth-buttons";
import { LogoutButton } from "@/components/navbar/logout-button";
import { cn } from "@/lib/utils";

import { MobileMenu } from "./mobile-menu";
import { MobileMenuButton } from "./mobile-menu-button";
import { NavLinks } from "./nav-links";
import { NavbarActions } from "./navbar-actions";
import { WrappedButton } from "./wrapped-button";

export function NavbarClient() {
  const [expanded, setExpanded] = useState(false);
  const { isAuthenticated } = useContext(AppContext);
  const closeMobileMenu = () => {
    setExpanded(false);
  };

  return (
    <header
      className={cn(
        "flex flex-col gap-2 py-4",
        expanded && "bg-background z-50 -mx-4 px-4",
      )}
    >
      <div className="flex items-center justify-between gap-4 sm:px-4">
        <nav className="flex items-center gap-6">
          <Link href="/">
            <AppLogo />
          </Link>
          <NavLinks variant="desktop" />
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <WrappedButton />
          <AuthButtons />
          <NavbarActions />
          {isAuthenticated ? <LogoutButton /> : null}
        </div>
        <MobileMenuButton
          expanded={expanded}
          onToggle={() => {
            setExpanded(!expanded);
          }}
        />
      </div>
      {expanded ? <MobileMenu onNavigate={closeMobileMenu} /> : null}
    </header>
  );
}
