import type { AccountType } from "@/types/user";

export interface JWTPayload {
  token_type: "access" | "refresh";
  exp: number;
  iat: number;
  jti: string;
  user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  student_number: string;
  photo: string | null;
  is_staff: boolean;
  is_superuser: boolean;
  is_banned: boolean;
  account_type: AccountType;
  account_level: "basic" | "gold";
}

export interface TokenRefreshResponse {
  access: string;
  refresh: string;
}
