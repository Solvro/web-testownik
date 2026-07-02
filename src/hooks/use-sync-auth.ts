import { useCallback, useEffect, useRef, useState } from "react";

import { decodeAccessToken } from "@/lib/auth/jwt-utils";
import type { JWTPayload } from "@/lib/auth/types";
import { AUTH_COOKIE_NAMES, getCookie } from "@/lib/cookies";
import { getQueryClient } from "@/lib/query-client";
import { getUserService } from "@/services";

export function useSyncAuth(initialUser: JWTPayload | null) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    initialUser !== null,
  );
  const [user, setUser] = useState<JWTPayload | null>(initialUser);
  const isAuthenticatedRef = useRef(initialUser !== null);
  const userRef = useRef<JWTPayload | null>(initialUser);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
    userRef.current = user;
  }, [isAuthenticated, user]);

  const readToken = useCallback((): {
    hasToken: boolean;
    payload: JWTPayload | null;
  } => {
    const accessToken = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
    const hasToken = accessToken !== null && accessToken.trim() !== "";
    const payload = hasToken ? decodeAccessToken(accessToken) : null;
    return { hasToken, payload };
  }, []);

  const applyAuthenticatedPayload = useCallback((payload: JWTPayload) => {
    isAuthenticatedRef.current = true;
    userRef.current = payload;

    setIsAuthenticated(true);
    setUser((previousUser) => {
      if (previousUser !== null && previousUser.user_id !== payload.user_id) {
        const queryClient = getQueryClient();
        void queryClient.resetQueries();
      }
      return payload;
    });
  }, []);

  const clearAuthenticatedPayload = useCallback(() => {
    userRef.current = null;
    isAuthenticatedRef.current = false;

    setUser(null);
    setIsAuthenticated((previousIsAuthenticated) => {
      if (previousIsAuthenticated) {
        const queryClient = getQueryClient();
        void queryClient.resetQueries();
      }
      return false;
    });
  }, []);

  const syncAuthFromCookies = useCallback(async () => {
    const { hasToken, payload } = readToken();

    if (hasToken && payload !== null) {
      applyAuthenticatedPayload(payload);
      return;
    }

    const hadAuthenticatedSession =
      isAuthenticatedRef.current || userRef.current !== null;

    if (hadAuthenticatedSession) {
      const refreshed = await getUserService().refreshToken();

      if (refreshed) {
        const latest = readToken();
        if (latest.hasToken && latest.payload !== null) {
          applyAuthenticatedPayload(latest.payload);
          return;
        }
      }
    }

    clearAuthenticatedPayload();
  }, [applyAuthenticatedPayload, clearAuthenticatedPayload, readToken]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    void syncAuthFromCookies();

    const handleFocus = () => {
      void syncAuthFromCookies();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAuthFromCookies();
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
        void syncAuthFromCookies();
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

  return { isAuthenticated, user };
}
