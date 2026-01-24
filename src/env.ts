import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    JWT_SECRET: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_TURN_USERNAME: z.string().optional(),
    NEXT_PUBLIC_TURN_CREDENTIAL: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME,
    NEXT_PUBLIC_TURN_CREDENTIAL: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
  },
});
