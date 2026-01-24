import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { PropsWithChildren } from "react";

import { AppContextProvider } from "@/app-context-provider";
import { AUTH_COOKIES, GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { deleteCookie, setCookie } from "@/lib/cookies";

interface ProvidersProps extends PropsWithChildren {
  guest?: boolean;
  accessToken?: string;
}

export function Providers({
  children,
  guest = false,
  accessToken,
}: ProvidersProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [queryClient, setQueryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );

  deleteCookie(AUTH_COOKIES.ACCESS_TOKEN);

  if (guest) {
    setCookie(GUEST_COOKIE_NAME, "true");
  } else {
    if (accessToken != null) {
      setCookie(AUTH_COOKIES.ACCESS_TOKEN, accessToken);
    }
    deleteCookie(GUEST_COOKIE_NAME);
  }

  return (
    <AppContextProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppContextProvider>
  );
}
