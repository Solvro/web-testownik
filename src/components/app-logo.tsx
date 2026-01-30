/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Image from "next/image";

import LogoDark from "@/assets/logo-dark.svg";
import Logo from "@/assets/logo.svg";

export function AppLogo(): React.JSX.Element {
  return (
    <>
      <Image src={Logo} alt="Logo" className="h-9 w-full dark:hidden" />
      <Image
        src={LogoDark}
        alt="Logo"
        className="hidden h-9 w-full dark:block"
      />
    </>
  );
}
