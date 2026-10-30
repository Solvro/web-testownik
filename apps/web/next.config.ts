import type { NextConfig } from "next";

const s3Url = new URL(process.env.S3_URL ?? "https://s3.b.solvro.pl");

const nextConfig: NextConfig = {
  reactCompiler: true,
  headers() {
    return [
      {
        // The landing's device model and covers: every file is versioned
        // (`-v1` in the name, `?v=` on the model), so they can be cached
        // like the hashed chunks instead of revalidated on each visit.
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  transpilePackages: ["@testownik/core"],
  serverExternalPackages: ["sharp"],
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      ...(process.env.NODE_ENV === "development"
        ? [
            {
              protocol: "http" as const,
              hostname: "localhost",
              port: "8000",
            },
          ]
        : []),
      {
        protocol: s3Url.protocol.replace(":", "") as "http" | "https",
        hostname: s3Url.hostname,
        port: s3Url.port,
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        // Partner logos from the uniperks feed (`PERKS_LOGO_HOST`).
        protocol: "https",
        hostname: "static.uniperks.pl",
      },
    ],
  },
};

export default nextConfig;
