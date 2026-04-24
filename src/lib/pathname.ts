export function normalizePathname(pathname: string): string {
  const collapsedPathname = pathname.replaceAll(/\/{2,}/g, "/");

  if (collapsedPathname === "") {
    return "/";
  }

  if (collapsedPathname.startsWith("/")) {
    return collapsedPathname;
  }

  return `/${collapsedPathname}`;
}

/**
 * Keep redirects on the current origin and avoid malformed paths (for example "////").
 */
export function sanitizeRedirectPath(
  redirect: string | null | undefined,
  fallbackPathname = "/quizzes",
): string {
  if (redirect === null || redirect === undefined || redirect.trim() === "") {
    return fallbackPathname;
  }

  try {
    const origin = "https://testownik.local";
    const parsedRedirect = new URL(redirect, origin);

    if (parsedRedirect.origin !== origin) {
      return fallbackPathname;
    }

    const normalizedPathname = normalizePathname(parsedRedirect.pathname);
    return `${normalizedPathname}${parsedRedirect.search}${parsedRedirect.hash}`;
  } catch {
    return fallbackPathname;
  }
}
