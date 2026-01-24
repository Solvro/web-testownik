import { CopyJWTAccessTokenButton } from "@/components/copy-jwt-button";
import { ModeToggle } from "@/components/mode-toggle";

interface NavbarActionsProps {
  isAuthenticated: boolean;
  isGuest: boolean;
}

export function NavbarActions({
  isAuthenticated,
  isGuest,
}: NavbarActionsProps) {
  return (
    <>
      <CopyJWTAccessTokenButton
        isAuthenticated={isAuthenticated}
        isGuest={isGuest}
      />
      <ModeToggle />
    </>
  );
}
