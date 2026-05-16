import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    JWT_SECRET: z.string().min(1).optional(),
    JWT_COOKIE_DOMAIN: z.string().min(1).optional(),
    INTERNAL_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_SITE_URL: z.url().default("https://testownik.solvro.pl"),
    NEXT_PUBLIC_TURN_USERNAME: z.string().optional(),
    NEXT_PUBLIC_TURN_CREDENTIAL: z.string().optional(),
    NEXT_PUBLIC_ALERTS_APP_CODE: z.string().min(1).default("testownik"),
    NEXT_PUBLIC_AI_ENABLED: z.stringbool().default(true),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME,
    NEXT_PUBLIC_TURN_CREDENTIAL: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    NEXT_PUBLIC_ALERTS_APP_CODE: process.env.NEXT_PUBLIC_ALERTS_APP_CODE,
    NEXT_PUBLIC_AI_ENABLED: process.env.NEXT_PUBLIC_AI_ENABLED,
  },
});
