import sharp from "sharp";

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const FETCH_TIMEOUT_MS = 10_000;

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

export async function resolveImages(
  urls: string[],
): Promise<{ type: "image"; image: string }[]> {
  const results = await Promise.allSettled(
    urls.map(async (url) => fetchImageAsBase64(url)),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled",
    )
    .map((r) => ({ type: "image" as const, image: r.value }));
}
