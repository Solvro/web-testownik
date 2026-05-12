import type { MetadataRoute } from "next";

const BASE_URL = "https://testownik.solvro.pl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
