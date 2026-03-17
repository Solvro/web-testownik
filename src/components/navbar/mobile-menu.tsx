"use client";

import { AuthButtons } from "./auth-buttons";
import { NavLinks } from "./nav-links";
import { NavbarActions } from "./navbar-actions";

export function MobileMenu() {
  return (
    <nav className="flex flex-col gap-2 border-t pt-2 md:hidden">
      <NavLinks variant="mobile" />
      <div className="flex flex-wrap gap-2 pt-2">
        <AuthButtons />
        <NavbarActions />
      </div>
    </nav>
  );
}
