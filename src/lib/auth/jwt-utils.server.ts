import { jwtVerify } from "jose";
import "server-only";

import { env } from "@/env";

import type { JWTPayload } from "./types";

export async function verifyAccessToken(
  token: string,
): Promise<JWTPayload | null> {
  const secret = env.JWT_SECRET;

  if (secret === undefined || secret === "") {
    console.error("JWT_SECRET environment variable is not set");
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error("Failed to verify access token", error);
    return null;
  }
}
