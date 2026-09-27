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
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_REQUEST = 12;
const MAX_CONCURRENT_FETCHES = 3;
const MAX_INPUT_PIXELS = 40_000_000;

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

async function readResponseWithLimit(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the allowed size");
  }
  if (response.body === null) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let readResult = await reader.read();
  while (!readResult.done) {
    const { value } = readResult;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Image exceeds the allowed size");
    }
    chunks.push(value);
    readResult = await reader.read();
  }
  return Buffer.concat(chunks, totalBytes);
}

async function fetchImageAsBase64(
  url: string,
  requestSignal?: AbortSignal,
): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    redirect: "manual",
    signal:
      requestSignal === undefined
        ? timeoutSignal
        : AbortSignal.any([requestSignal, timeoutSignal]),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Image redirects are not allowed");
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status.toString()}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0];
  const buffer = await readResponseWithLimit(response);

  if (contentType !== undefined && SUPPORTED_MIME_TYPES.has(contentType)) {
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  const jpegBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

export async function resolveImages(
  labeledImages: LabeledImage[],
  signal?: AbortSignal,
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [];
  const images = labeledImages.slice(0, MAX_IMAGES_PER_REQUEST);
  const uniqueUrls = [...new Set(images.map(({ url }) => url))];
  const resolved = new Map<string, string | null>();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < uniqueUrls.length) {
      const url = uniqueUrls[nextIndex];
      nextIndex += 1;
      if (!isTrustedUrl(url)) {
        resolved.set(url, null);
        continue;
      }
      try {
        resolved.set(url, await fetchImageAsBase64(url, signal));
      } catch {
        resolved.set(url, null);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_FETCHES, uniqueUrls.length) },
      worker,
    ),
  );

  for (const { label, url } of images) {
    const data = resolved.get(url);
    if (data === null || data === undefined) {
      parts.push({
        type: "text",
        text: `[${label}: obraz niedostępny]`,
      });
    } else {
      parts.push(
        { type: "text", text: `[${label}]` },
        { type: "image", image: data },
      );
    }
  }

  return parts;
}
