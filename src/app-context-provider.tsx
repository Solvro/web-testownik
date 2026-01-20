"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { API_URL } from "@/lib/api";
import { GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import {
  AUTH_COOKIE_NAMES,
  deleteCookie,
  getCookie,
  setCookie,
} from "@/lib/cookies";

import { getServices, initializeServices } from "./services";

initializeServices(API_URL);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const accessToken = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
      const hasToken = accessToken !== null && accessToken.trim() !== "";

      const isGuestFromCookie = getCookie(GUEST_COOKIE_NAME) === "true";
      const isGuestFromStorage = localStorage.getItem("is_guest") === "true";
      const isGuestMode = isGuestFromCookie || isGuestFromStorage;

      if (isGuestFromStorage && !isGuestFromCookie) {
        setCookie(GUEST_COOKIE_NAME, "true", {
          maxAge: 12 * 30 * 24 * 60 * 60,
        });
      }

      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setIsAuthenticated(hasToken);
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setIsGuest(isGuestMode);
    }
  }, []);

  const setGuest = (isGuestParameter: boolean) => {
    if (isGuestParameter) {
      setCookie(GUEST_COOKIE_NAME, "true", { maxAge: 12 * 30 * 24 * 60 * 60 });
      localStorage.setItem("is_guest", "true");
    } else {
      deleteCookie(GUEST_COOKIE_NAME);
      localStorage.removeItem("is_guest");
    }
    setIsGuest(isGuestParameter);
  };

  const setAuthenticated = (value: boolean) => {
    setIsAuthenticated(value);
    if (!value) {
      setGuest(false);
    }
  };

  const context: AppContextType = {
    isAuthenticated,
    setAuthenticated,
    isGuest,
    setGuest,
    services: getServices(),
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}
