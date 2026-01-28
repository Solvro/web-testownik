import type { NextConfig } from "next";

const s3Url = new URL(process.env.S3_URL ?? "https://s3.b.solvro.pl");

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    viewTransition: true,
  },
  images: {
    dangerouslyAllowLocalIP: true,
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
    ],
  },
};

export default nextConfig;
