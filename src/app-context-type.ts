import type { JWTPayload } from "@/lib/auth/types";

import type { PermissionAction } from "./lib/auth/permissions";
import type { ServiceRegistry } from "./services";

export interface AppContextType {
  isAuthenticated: boolean;
  user: JWTPayload | null;
  services: ServiceRegistry;
  checkPermission: (action: PermissionAction) => boolean;
}
