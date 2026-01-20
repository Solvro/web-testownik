import type { JWTPayload } from "@/lib/auth/types";

import type { ServiceRegistry } from "./services";

export interface AppContextType {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
  isGuest: boolean;
  setGuest: (isGuest: boolean) => void;
  user: JWTPayload | null;
  services: ServiceRegistry;
}
