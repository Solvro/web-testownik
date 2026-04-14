"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";

import { AppContextProvider } from "@/app-context-provider";
import { FormbricksProvider } from "@/app/formbricks";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { JWTPayload } from "@/lib/auth/types";
import { getQueryClient } from "@/lib/query-client";

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: JWTPayload | null;
}) {
  const queryClient = getQueryClient();
  return (
    <AppContextProvider initialUser={initialUser}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={0}>
          <Suspense>
            <FormbricksProvider />
          </Suspense>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </TooltipProvider>
      </QueryClientProvider>
    </AppContextProvider>
  );
}
