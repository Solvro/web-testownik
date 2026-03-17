import { ModeToggle } from "@/components/mode-toggle";

import { CopyJWTAccessTokenButton } from "./copy-jwt-button";

export function NavbarActions() {
  return (
    <>
      <CopyJWTAccessTokenButton />
      <ModeToggle />
    </>
  );
}
