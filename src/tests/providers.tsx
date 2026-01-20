import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";

import { AppContextProvider } from "@/app-context-provider";
import { AUTH_COOKIES, GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { deleteCookie, setCookie } from "@/lib/cookies";

// Valid JWT token with future expiration (exp: 9999999999)
const TEST_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTksInVzZXJfaWQiOjEsInVzZXJuYW1lIjoidGVzdHVzZXIifQ.SIGNATURE_IGNORED_ON_CLIENT";

interface ProvidersProps extends PropsWithChildren {
  guest?: boolean;
}

export function Providers({ children, guest = false }: ProvidersProps) {
  deleteCookie(AUTH_COOKIES.ACCESS_TOKEN);

  if (guest) {
    setCookie(GUEST_COOKIE_NAME, "true");
  } else {
    setCookie(AUTH_COOKIES.ACCESS_TOKEN, TEST_ACCESS_TOKEN);
    deleteCookie(GUEST_COOKIE_NAME);
  }

  return (
    <MemoryRouter>
      <AppContextProvider>{children}</AppContextProvider>
    </MemoryRouter>
  );
}
