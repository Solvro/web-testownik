import sharp from "sharp";

import { env } from "@/env";
import type { LabeledImage } from "@/lib/ai/prompts";

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const FETCH_TIMEOUT_MS = 10_000;

const TRUSTED_ORIGINS = [env.NEXT_PUBLIC_API_URL, env.S3_URL];

function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TRUSTED_ORIGINS.some(
      (base) => base !== undefined && parsed.origin === new URL(base).origin,
    );
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status.toString()}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0];
  const buffer = Buffer.from(await response.arrayBuffer());

  if (contentType !== undefined && SUPPORTED_MIME_TYPES.has(contentType)) {
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  const jpegBuffer = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

export async function resolveImages(
  labeledImages: LabeledImage[],
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [];

  const results = await Promise.allSettled(
    labeledImages.map(async ({ label, url }) => {
      if (!isTrustedUrl(url)) {
        return { label, status: "skipped" as const };
      }
      const data = await fetchImageAsBase64(url);
      return { label, status: "ok" as const, data };
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      continue;
    }
    const value = result.value;
    if (value.status === "skipped") {
      parts.push({
        type: "text",
        text: `[${value.label}: niedostępny — zewnętrzne źródło]`,
      });
    } else {
      parts.push(
        { type: "text", text: `[${value.label}]` },
        { type: "image", image: value.data },
      );
    }
  }

  return parts;
}
