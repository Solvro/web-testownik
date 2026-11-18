/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Image from "next/image";

import LogoDark from "@/assets/logo-dark.svg";
import LogoFullDark from "@/assets/logo-full-dark.svg";
import LogoFull from "@/assets/logo-full.svg";
import Logo from "@/assets/logo.svg";

export function AppLogo(): React.JSX.Element {
  return (
    <>
      <Image src={Logo} alt="Logo" className="h-9 w-auto dark:hidden" />
      <Image
        src={LogoDark}
        alt="Logo"
        className="hidden h-9 w-auto dark:block"
      />
    </>
  );
}

/** The logo with the Testownik name next to it. */
export function AppLogoFull(): React.JSX.Element {
  return (
    <>
      <Image
        src={LogoFull}
        alt="Testownik"
        className="h-9 w-auto dark:hidden"
      />
      <Image
        src={LogoFullDark}
        alt="Testownik"
        className="hidden h-9 w-auto dark:block"
      />
    </>
  );
}
