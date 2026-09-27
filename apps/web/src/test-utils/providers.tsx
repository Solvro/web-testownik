import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { PropsWithChildren } from "react";

import { AppContextProvider } from "@/app-context-provider";
import { AUTH_COOKIES } from "@/lib/auth/constants";
import { deleteCookie, setCookie } from "@/lib/cookies";

interface ProvidersProps extends PropsWithChildren {
  accessToken?: string;
}

export function Providers({ children, accessToken }: ProvidersProps) {
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

  if (accessToken != null) {
    setCookie(AUTH_COOKIES.ACCESS_TOKEN, accessToken);
  }

  return (
    <AppContextProvider initialUser={null}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppContextProvider>
  );
}
