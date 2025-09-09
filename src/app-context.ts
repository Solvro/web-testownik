import { createContext } from "react";

import type { AppContextType } from "./app-context-type";
import type { ServiceRegistry } from "./services";

export const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  setAuthenticated: () => {
    // no-op
  },
  isGuest: false,
  setGuest: () => {
    // no-op
  },
  services: null as unknown as ServiceRegistry, // This will be set in the provider
});
