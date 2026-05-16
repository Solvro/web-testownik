import type { MetadataRoute } from "next";

import { env } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: env.NEXT_PUBLIC_SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${env.NEXT_PUBLIC_SITE_URL}/quizzes`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${env.NEXT_PUBLIC_SITE_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${env.NEXT_PUBLIC_SITE_URL}/privacy-policy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
