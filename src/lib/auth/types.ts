export interface JWTPayload {
  token_type: "access" | "refresh";
  exp: number;
  iat: number;
  jti: string;
  user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  student_number: string;
  photo: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface TokenRefreshResponse {
  access: string;
  refresh: string;
}
