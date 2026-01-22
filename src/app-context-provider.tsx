"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { API_URL } from "@/lib/api";
import { GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { decodeAccessToken } from "@/lib/auth/jwt-utils";
import type { JWTPayload } from "@/lib/auth/types";
import {
  AUTH_COOKIE_NAMES,
  deleteCookie,
  getCookie,
  setCookie,
} from "@/lib/cookies";

import { getServices, initializeServices } from "./services";

initializeServices(API_URL);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [user, setUser] = useState<JWTPayload | null | undefined>();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const accessToken = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
      const hasToken = accessToken !== null && accessToken.trim() !== "";

      const isGuestFromCookie = getCookie(GUEST_COOKIE_NAME) === "true";
      // localStorage is a legacy way of storing guest mode state, should be removed in the future
      const isGuestFromStorage = localStorage.getItem("is_guest") === "true";
      const isGuestMode = isGuestFromCookie || isGuestFromStorage;

      if (isGuestFromStorage && !isGuestFromCookie) {
        setCookie(GUEST_COOKIE_NAME, "true", {
          maxAge: 12 * 30 * 24 * 60 * 60,
        });
      }

      const payload = hasToken ? decodeAccessToken(accessToken) : null;

      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setIsAuthenticated(hasToken);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setIsGuest(isGuestMode);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setUser(payload);
    }
  }, []);

  const setGuest = (isGuestParameter: boolean) => {
    if (isGuestParameter) {
      setCookie(GUEST_COOKIE_NAME, "true", { maxAge: 12 * 30 * 24 * 60 * 60 });
    } else {
      deleteCookie(GUEST_COOKIE_NAME);
    }
    setIsGuest(isGuestParameter);
    router.refresh();
  };

  const setAuthenticated = (value: boolean) => {
    setIsAuthenticated(value);
    if (value) {
      const accessToken = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
      if (accessToken !== null && accessToken.trim() !== "") {
        setUser(decodeAccessToken(accessToken));
      }
    } else {
      setGuest(false);
      setUser(null);
    }
  };

  const context: AppContextType = {
    isAuthenticated,
    setAuthenticated,
    isGuest,
    setGuest,
    user,
    services: getServices(),
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}
