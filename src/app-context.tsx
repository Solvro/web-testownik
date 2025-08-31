import type { AxiosInstance } from "axios";
import axios from "axios";
import React, { createContext, useCallback, useState } from "react";

import { SERVER_URL } from "./config";
import requestInterceptor from "./interceptors/request-interceptor.ts";
import responseInterceptor, {
  RefreshTokenExpiredError,
} from "./interceptors/response-interceptor.ts";

export interface AppContextType {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
  isGuest: boolean;
  setGuest: (isGuest: boolean) => void;
  axiosInstance: AxiosInstance;
  fetchUserData: () => Promise<void>;
}

const axiosInstance = axios.create({
  baseURL: SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(requestInterceptor, (error) => {
  throw new Error(String(error));
});
axiosInstance.interceptors.response.use(
  (response) => response,
  responseInterceptor,
);

const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  setAuthenticated: () => {
    // Default implementation - will be overridden by provider
  },
  isGuest: false,
  setGuest: () => {
    // Default implementation - will be overridden by provider
  },
  axiosInstance,
  fetchUserData: async () => {
    // Default implementation - will be overridden by provider
  },
});

function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem("access_token")),
  );
  const [isGuest, setIsGuest] = useState<boolean>(
    localStorage.getItem("is_guest") === "true",
  );

  const setGuest = (guestStatus: boolean) => {
    localStorage.setItem("is_guest", guestStatus.toString());
    setIsGuest(guestStatus);
  };

  const fetchUserData = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/user/");
      if (response.data === null || response.data === undefined) {
        throw new Error("No user data available");
      }
      const userData = response.data as {
        photo: string;
        is_staff: boolean;
        id: string;
      };
      localStorage.setItem("profile_picture", userData.photo);
      localStorage.setItem("is_staff", userData.is_staff.toString());
      localStorage.setItem("user_id", userData.id);
      setIsAuthenticated(true);
    } catch {
      console.error("Failed to fetch user data");
    }
  }, []);

  const context: AppContextType = {
    isAuthenticated,
    setAuthenticated: setIsAuthenticated,
    isGuest,
    setGuest,
    axiosInstance,
    fetchUserData,
  };

  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error instanceof RefreshTokenExpiredError) {
        localStorage.removeItem("profile_picture");
        localStorage.removeItem("is_staff");
        localStorage.removeItem("user_id");
        context.setAuthenticated(false);
      }
      throw new Error(String(error));
    },
  );

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

export { AppContextProvider };

export default AppContext;
