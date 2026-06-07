"use client";

import { useContext } from "react";

import { AppContext } from "@/app-context";

import { AuthButtons } from "./auth-buttons";
import { LogoutButton } from "./logout-button";
import { NavLinks } from "./nav-links";
import { NavbarActions } from "./navbar-actions";

interface MobileMenuProps {
  onNavigate?: () => void;
}

export function MobileMenu({ onNavigate }: MobileMenuProps) {
  const { isAuthenticated } = useContext(AppContext);

  return (
    <nav className="flex flex-col gap-2 border-t pt-2 md:hidden">
      <NavLinks variant="mobile" onNavigate={onNavigate} />
      <div className="flex flex-wrap gap-2 pt-2">
        <AuthButtons onNavigate={onNavigate} />
        <NavbarActions />
        {isAuthenticated ? <LogoutButton onLogout={onNavigate} /> : null}
      </div>
    </nav>
  );
}
