import type { AxiosInstance } from "axios";
import { createContext } from "react";

import type { AppContextType } from "./app-context-type";

export const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  setAuthenticated: () => {
    // no-op
  },
  isGuest: false,
  setGuest: () => {
    // no-op
  },
  axiosInstance: null as unknown as AxiosInstance, // This will be set in the provider
  fetchUserData: async () => {
    // no-op
  },
});
