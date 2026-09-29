export interface EmbeddedTheme {
  background: string;
  foreground: string;
  dark: boolean;
}
export function parseEmbeddedTheme(message: string): EmbeddedTheme | null {
  if (message.length > 256) return null;
  try {
    const value: unknown = JSON.parse(message);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      item.type !== "wrapped-theme" ||
      typeof item.background !== "string" ||
      typeof item.foreground !== "string" ||
      typeof item.dark !== "boolean"
    )
      return null;
    const hex = /^#[\da-f]{6}$/i;
    if (!hex.test(item.background) || !hex.test(item.foreground)) return null;
    return {
      background: item.background,
      foreground: item.foreground,
      dark: item.dark,
    };
  } catch {
    return null;
  }
}
