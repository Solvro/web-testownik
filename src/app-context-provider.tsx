"use client";

import type { ReactNode } from "react";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { useGuestQuizMigration } from "@/hooks/use-guest-quiz-migration";
import { useSyncAuth } from "@/hooks/use-sync-auth";
import { API_URL } from "@/lib/api";
import type { JWTPayload } from "@/lib/auth/types";

import { hasPermission } from "./lib/auth/permissions";
import type { PermissionAction } from "./lib/auth/permissions";
import { getServices, initializeServices } from "./services";

initializeServices(API_URL);

export function AppContextProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: JWTPayload | null;
}) {
  const { isAuthenticated, user } = useSyncAuth(initialUser);
  useGuestQuizMigration(user);

  const checkPermission = (action: PermissionAction) =>
    hasPermission(user?.account_type, action);

  const context: AppContextType = {
    isAuthenticated,
    user,
    services: getServices(),
    checkPermission,
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}
