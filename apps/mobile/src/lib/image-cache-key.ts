import { sha256 } from "@noble/hashes/sha2";

const names = new Map<string, string>();
/** Hash exact URL code units, so normalization cannot merge distinct requests. */
export function imageCacheName(url: string): string {
  const cached = names.get(url);
  if (cached) return cached;
  const bytes = new Uint8Array(url.length * 2);
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    bytes[i * 2] = code >>> 8;
    bytes[i * 2 + 1] = code & 255;
  }
  const digest = Array.from(sha256(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const extension =
    /\.(png|jpe?g|gif|webp|avif|heic)(?:$|[?#])/i.exec(url)?.[1] ?? "img";
  const name = `${digest}.${extension}`;
  // Bound render-time memoization independently of downloaded library size.
  if (names.size >= 256) names.delete(names.keys().next().value!);
  names.set(url, name);
  return name;
}
