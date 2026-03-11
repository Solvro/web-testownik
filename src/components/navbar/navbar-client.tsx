"use client";

import Link from "next/link";
import { useState } from "react";

import { AppLogo } from "@/components/app-logo";
import { AuthButtons } from "@/components/navbar/auth-buttons";

import { MobileMenu } from "./mobile-menu";
import { MobileMenuButton } from "./mobile-menu-button";
import { NavLinks } from "./nav-links";
import { NavbarActions } from "./navbar-actions";

export function NavbarClient() {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-4 sm:px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <AppLogo />
          </Link>
          <NavLinks variant="desktop" />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NavbarActions />
          <AuthButtons />
        </div>
        <MobileMenuButton
          expanded={expanded}
          onToggle={() => {
            setExpanded(!expanded);
          }}
        />
      </div>
      {expanded ? <MobileMenu /> : null}
    </nav>
  );
}
