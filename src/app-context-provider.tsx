import React, { useState } from "react";

import type { AppContextType } from "@/app-context-type";
import { AppContext } from "@/app-context.ts";

import { SERVER_URL } from "./config";
import { getServices, initializeServices } from "./services";

initializeServices(SERVER_URL);

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem("access_token")),
  );
  const [isGuest, setIsGuest] = useState<boolean>(
    localStorage.getItem("is_guest") === "true",
  );

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
