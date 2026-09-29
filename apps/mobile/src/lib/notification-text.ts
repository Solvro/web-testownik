import MarkdownIt from "markdown-it";
const markdown = new MarkdownIt({ html: true, breaks: true });

export interface NotificationPart {
  text: string;
  href?: string;
}

export function notificationParts(content: string): NotificationPart[] {
  const text = notificationText(content);
  const parts: NotificationPart[] = [];
  let cursor = 0;
  // Linkify handles punctuation and balanced parentheses in URLs. Only explicit
  // HTTP(S) destinations become actions; email and custom schemes stay text.
  for (const match of markdown.linkify.match(text) ?? []) {
    if (!/^https?:\/\//i.test(match.raw)) continue;
    if (match.index > cursor)
      parts.push({ text: text.slice(cursor, match.index) });
    parts.push({ text: match.raw, href: match.url });
    cursor = match.lastIndex;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

// Notification bodies may contain server-authored HTML or Markdown. Render
// them as native text: no web process, remote image loads or executable markup.
export function notificationText(content: string): string {
  return markdown
    .render(content)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(
      /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
      (_tag, _quote, href: string, text: string) =>
        /^https?:\/\//i.test(href) && text !== href
          ? `${text} (${href})`
          : text,
    )
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6]|blockquote|pre|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, (entity) =>
      markdown.utils.unescapeAll(entity),
    )
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
