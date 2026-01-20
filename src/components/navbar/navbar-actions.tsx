import { CopyJWTAccessTokenButton } from "@/components/copy-jwt-button";
import { ModeToggle } from "@/components/mode-toggle";

interface NavbarActionsProps {
  isAuthenticated: boolean;
}

export function NavbarActions({ isAuthenticated }: NavbarActionsProps) {
  return (
    <>
      <CopyJWTAccessTokenButton isAuthenticated={isAuthenticated} />
      <ModeToggle />
    </>
  );
}
