"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { API_URL } from "@/lib/api";
import { decodeAccessToken } from "@/lib/auth/jwt-utils";
import type { JWTPayload } from "@/lib/auth/types";
import { AUTH_COOKIE_NAMES, getCookie } from "@/lib/cookies";
import { migrateLegacyGuestQuizzes } from "@/lib/legacy-guest-quiz-migration";
import { getQueryClient } from "@/lib/query-client";
import { ACCOUNT_TYPE } from "@/types/user";

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
  const migrationUserIdRef = useRef<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    initialUser !== null,
  );
  const [user, setUser] = useState<JWTPayload | null>(initialUser);
  const readToken = useCallback((): {
    hasToken: boolean;
    payload: JWTPayload | null;
  } => {
    const accessToken = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
    const hasToken = accessToken !== null && accessToken.trim() !== "";
    const payload = hasToken ? decodeAccessToken(accessToken) : null;
    return { hasToken, payload };
  }, []);

  const syncAuthFromCookies = useCallback(() => {
    const { hasToken, payload } = readToken();

    if (hasToken && payload !== null) {
      setIsAuthenticated(true);
      setUser(payload);
      return;
    }

    setUser(null);
    setIsAuthenticated((previousIsAuthenticated) => {
      if (previousIsAuthenticated) {
        const queryClient = getQueryClient();
        queryClient.clear();
      }
      return false;
    });
  }, [readToken]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    syncAuthFromCookies();

    const handleFocus = () => {
      syncAuthFromCookies();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAuthFromCookies();
      }
    };

    const handleCookieStoreChange = (event: CookieChangeEvent) => {
      const changedCookies = [...event.changed, ...event.deleted];
      const authCookieChanged = changedCookies.some(
        (cookie) =>
          cookie.name === AUTH_COOKIE_NAMES.ACCESS_TOKEN ||
          cookie.name === AUTH_COOKIE_NAMES.REFRESH_TOKEN,
      );

      if (authCookieChanged) {
        syncAuthFromCookies();
      }
    };

    if (typeof cookieStore !== "undefined") {
      cookieStore.addEventListener("change", handleCookieStoreChange);
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (typeof cookieStore !== "undefined") {
        cookieStore.removeEventListener("change", handleCookieStoreChange);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncAuthFromCookies]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (user === null) {
      migrationUserIdRef.current = null;
      return;
    }

    if (user.account_type !== ACCOUNT_TYPE.GUEST) {
      return;
    }

    if (migrationUserIdRef.current === user.user_id) {
      return;
    }

    migrationUserIdRef.current = user.user_id;

    void (async () => {
      const result = await migrateLegacyGuestQuizzes(getServices().quiz);

      if (result.migratedCount === 0) {
        return;
      }

      const queryClient = getQueryClient();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["user-quizzes"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["last-used-quizzes"],
        }),
      ]);
    })();
  }, [user]);

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
