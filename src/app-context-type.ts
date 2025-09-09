import type { ServiceRegistry } from "./services";

export interface AppContextType {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
  isGuest: boolean;
  setGuest: (isGuest: boolean) => void;
  services: ServiceRegistry;
}
