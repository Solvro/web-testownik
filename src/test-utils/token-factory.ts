import { CompactSign } from "jose";

import type { JWTPayload } from "@/lib/auth/types";

export const DEFAULT_USER_PAYLOAD: JWTPayload = {
  token_type: "access",
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  iat: Math.floor(Date.now() / 1000),
  jti: "test-jti",
  user_id: "836311fc-084e-497d-ab95-962cc40d6393",
  first_name: "Test",
  last_name: "User",
  full_name: "Test User",
  email: "test@example.com",
  student_number: "123456",
  photo: "https://example.com/avatar.jpg",
  is_staff: false,
  is_superuser: false,
};

/**
 * Generates a signed JWT for testing.
 * @param payloadOverrides Partial payload to override defaults
 * @returns Promise<string> The signed JWT string
 */
export async function generateTestToken(
  payloadOverrides: Partial<JWTPayload> = {},
): Promise<string> {
  const payload = { ...DEFAULT_USER_PAYLOAD, ...payloadOverrides };
  const rawSecret = new TextEncoder().encode("test-secret-key-1234567890");
  const secret = new Uint8Array(rawSecret);

  const jsonPayload = JSON.stringify(payload);
  const encodedPayload = new TextEncoder().encode(jsonPayload);
  const uint8Payload = new Uint8Array(encodedPayload);

  return await new CompactSign(uint8Payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secret);
}
