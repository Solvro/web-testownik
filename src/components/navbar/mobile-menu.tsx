"use client";

import { AuthButtons } from "./auth-buttons";
import type { AuthButtonsProps } from "./auth-buttons";
import { NavLinks } from "./nav-links";
import { NavbarActions } from "./navbar-actions";

interface MobileMenuProps extends Omit<AuthButtonsProps, "variant"> {
  isStaff: boolean;
}

export function MobileMenu({
  isAuthenticated,
  isGuest,
  isStaff,
  profilePicture,
}: MobileMenuProps) {
  return (
    <div className="flex flex-col gap-2 border-t pt-2 md:hidden">
      <NavLinks isStaff={isStaff} variant="mobile" />
      <div className="flex flex-wrap gap-2 pt-2">
        <AuthButtons
          isAuthenticated={isAuthenticated}
          isGuest={isGuest}
          profilePicture={profilePicture}
        />
        <NavbarActions isAuthenticated={isAuthenticated} isGuest={isGuest} />
      </div>
    </div>
  );
}
