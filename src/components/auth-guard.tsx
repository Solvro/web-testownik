"use client";

import { useContext } from "react";

import { AppContext } from "@/app-context";
import { LoginPrompt } from "@/components/login-prompt";

/**
 * Component that shows login prompt if user is not authenticated.
 * Use this to protect routes that require authentication.
 */
export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const context = useContext(AppContext);

  if (!context.isAuthenticated && !context.isGuest) {
    return <LoginPrompt />;
  }

  return children;
}
