import type { JWTPayload } from "@/lib/auth/types";

import type { PermissionAction } from "./lib/auth/permissions";

export interface AppContextType {
  isAuthenticated: boolean;
  user: JWTPayload | null;
  checkPermission: (action: PermissionAction) => boolean;
}
