/** Where a notification leads: a screen in the app, a web page, or nowhere. */
export type NotificationDestination =
  | { kind: "app"; href: string }
  | { kind: "web"; url: string }
  | null;

const FRONTEND_HOSTS = ["testownik.solvro.pl"];

/**
 * Notification links point at the web frontend (the same URL the e-mail button
 * uses). Pages the app has open in the app; anything else opens in the browser.
 */
export function notificationDestination(
  link: string | null | undefined,
  webUrl: string,
): NotificationDestination {
  if (!link?.trim()) return null;
  let url: URL;
  try {
    url = new URL(link, webUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const own =
    url.origin === new URL(webUrl).origin ||
    FRONTEND_HOSTS.includes(url.hostname);
  if (!own) return { kind: "web", url: url.href };
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const quiz = /^\/quiz\/([\w-]+)$/.exec(path);
  if (quiz) return { kind: "app", href: `/quiz/${quiz[1]}` };
  const edit = /^\/edit-quiz\/([\w-]+)$/.exec(path);
  if (edit) {
    const question = /^question-([\w-]+)$/.exec(
      url.searchParams.get("scroll_to") ?? "",
    );
    return {
      kind: "app",
      href: `/editor?id=${edit[1]}${question ? `&question=${question[1]}` : ""}`,
    };
  }
  const tabs: Record<string, string> = {
    "/": "/",
    "/quizzes": "/library",
    "/grades": "/grades",
    "/profile": "/profile",
    "/wrapped": "/wrapped",
  };
  if (path in tabs) return { kind: "app", href: tabs[path] };
  return { kind: "web", url: url.href };
}
