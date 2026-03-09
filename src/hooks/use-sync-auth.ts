import { useCallback, useEffect, useState } from "react";

import { decodeAccessToken } from "@/lib/auth/jwt-utils";
import type { JWTPayload } from "@/lib/auth/types";
import { AUTH_COOKIE_NAMES, getCookie } from "@/lib/cookies";
import { getQueryClient } from "@/lib/query-client";

export function useSyncAuth(initialUser: JWTPayload | null) {
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
      setUser((previousUser) => {
        if (previousUser !== null && previousUser.user_id !== payload.user_id) {
          const queryClient = getQueryClient();
          queryClient.clear();
        }
        return payload;
      });
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

  return { isAuthenticated, user };
}
