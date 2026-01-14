"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";

import { SERVER_URL } from "./config";
import { getServices, initializeServices } from "./services";

initializeServices(SERVER_URL);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setIsAuthenticated(Boolean(localStorage.getItem("access_token")));
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
      setIsGuest(localStorage.getItem("is_guest") === "true");
    }
  }, []);

  const setGuest = (isGuestParameter: boolean) => {
    localStorage.setItem("is_guest", isGuestParameter.toString());
    setIsGuest(isGuestParameter);
  };

  const context: AppContextType = {
    isAuthenticated,
    setAuthenticated: setIsAuthenticated,
    isGuest,
    setGuest,
    services: getServices(),
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}
