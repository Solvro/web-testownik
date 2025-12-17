import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";

import { AppContextProvider } from "@/app-context-provider";

interface ProvidersProps extends PropsWithChildren {
  guest?: boolean;
}

export function Providers({ children, guest = false }: ProvidersProps) {
  localStorage.setItem("is_guest", guest.toString());
  if (guest) {
    localStorage.removeItem("access_token");
  } else {
    localStorage.setItem("access_token", "test-token");
  }

  return (
    <MemoryRouter>
      <AppContextProvider>{children}</AppContextProvider>
    </MemoryRouter>
  );
}
