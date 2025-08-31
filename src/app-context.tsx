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

axiosInstance.interceptors.request.use(requestInterceptor, async (error) => {
  throw error;
});
axiosInstance.interceptors.response.use(
  (response) => response,
  responseInterceptor,
);

const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  setAuthenticated: () => {},
  isGuest: false,
  setGuest: () => {},
  axiosInstance,
  fetchUserData: async () => {},
});

const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem("access_token")),
  );
  const [isGuest, setIsGuest] = useState<boolean>(
    localStorage.getItem("is_guest") === "true",
  );

  const setGuest = (isGuest: boolean) => {
    localStorage.setItem("is_guest", isGuest.toString());
    setIsGuest(isGuest);
  };

  const fetchUserData = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/user/");
      if (!response.data) {
        throw new Error("No user data available");
      }
      const userData = response.data;
      localStorage.setItem("profile_picture", userData.photo);
      localStorage.setItem("is_staff", userData.is_staff);
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
    async (error) => {
      if (error instanceof RefreshTokenExpiredError) {
        localStorage.removeItem("profile_picture");
        localStorage.removeItem("is_staff");
        localStorage.removeItem("user_id");
        context.setAuthenticated(false);
      }
      throw error;
    },
  );

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
};

export { AppContextProvider };

export default AppContext;
