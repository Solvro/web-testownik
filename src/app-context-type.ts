import type { AxiosInstance } from "axios";

export interface AppContextType {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
  isGuest: boolean;
  setGuest: (isGuest: boolean) => void;
  axiosInstance: AxiosInstance;
  fetchUserData: () => Promise<void>;
}
