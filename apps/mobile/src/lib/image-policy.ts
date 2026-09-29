import MarkdownIt from "markdown-it";

// Match the established web image policy's trusted media hosts.
const trustedHosts = new Set([
  "s3.b.solvro.pl",
  "github.com",
  "githubusercontent.com",
  "raw.githubusercontent.com",
  "cdn.discordapp.com",
  "upload.wikimedia.org",
  "images.unsplash.com",
  "i.imgur.com",
  "lh3.googleusercontent.com",
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);
const markdown = new MarkdownIt({ html: false });
export type ImageApproval = boolean | ((url: string) => boolean);
export function imageHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.hostname
      : null;
  } catch {
    return null;
  }
}
export function isTrustedImage(url: string, apiUrl: string): boolean {
  if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(url)) return true;
  const host = imageHost(url);
  return !!host && (host === imageHost(apiUrl) || trustedHosts.has(host));
}
export function imageAllowed(url: string, approval: ImageApproval): boolean {
  // Never pass unsupported schemes to native image loaders or embedded content.
  if (!imageHost(url) && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(url))
    return false;
  return typeof approval === "function" ? approval(url) : approval;
}
export function markdownImages(text: string): string[] {
  const images: string[] = [];
  const visit = (tokens: ReturnType<typeof markdown.parse>) => {
    for (const token of tokens) {
      if (token.type === "image")
        images.push(String(token.attrGet("src") ?? ""));
      if (token.children) visit(token.children);
    }
  };
  visit(markdown.parse(text, {}));
  return images;
}
