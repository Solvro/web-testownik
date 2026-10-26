import type { NextConfig } from "next";

const s3Url = new URL(process.env.S3_URL ?? "https://s3.b.solvro.pl");

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["sharp"],
  // Next.js requires an async hook even though these headers are static.
  // eslint-disable-next-line @typescript-eslint/require-await
  async headers() {
    return [
      {
        source: "/.well-known/openai-apps-challenge",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
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
    ],
  },
};

export default nextConfig;
