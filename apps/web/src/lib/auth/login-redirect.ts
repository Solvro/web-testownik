/** Query parameters the backend appends to the return URL when a sign-in fails. */
const LOGIN_ERROR_PARAMETERS = new Set(["error", "ban_reason"]);

const OAUTH_AUTHORIZE_PATH = "/oauth/authorize";

export type SearchParameterRecord = Record<string, string | string[]>;

function toSearchParameters(parameters: SearchParameterRecord) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }
  return query;
}

/** Splits the sign-in error the backend appended from the parameters of the page itself. */
export function splitLoginError(parameters: SearchParameterRecord): {
  parameters: SearchParameterRecord;
  loginError: SearchParameterRecord;
} {
  const rest: SearchParameterRecord = {};
  const loginError: SearchParameterRecord = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (LOGIN_ERROR_PARAMETERS.has(key)) {
      loginError[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return { parameters: rest, loginError };
}

export function buildOAuthAuthorizePath(parameters: SearchParameterRecord) {
  const queryString = toSearchParameters(parameters).toString();
  return queryString.length > 0
    ? `${OAUTH_AUTHORIZE_PATH}?${queryString}`
    : OAUTH_AUTHORIZE_PATH;
}

export function isOAuthAuthorizePath(path: string | null): boolean {
  return (
    path !== null &&
    (path === OAUTH_AUTHORIZE_PATH ||
      path.startsWith(`${OAUTH_AUTHORIZE_PATH}?`))
  );
}

/** `/login` that returns to `returnPath` and shows `loginError`, if any. */
export function buildLoginPath(
  returnPath: string,
  loginError: SearchParameterRecord = {},
): string {
  const query = toSearchParameters(loginError);
  query.set("redirect", returnPath);
  return `/login?${query.toString()}`;
}

/** The header login link: back to the current page, or on `/login` keep its redirect. */
export function getHeaderLoginHref(pathname: string, search: string): string {
  if (pathname === "/login") {
    return search.length > 0 ? `/login?${search}` : "/login";
  }
  if (pathname === "/") {
    return "/login";
  }
  return buildLoginPath(search.length > 0 ? `${pathname}?${search}` : pathname);
}

/** Backend sign-in URL that comes back to `redirectUrl` once signed in. */
export function buildBackendLoginUrl(
  apiUrl: string,
  base: string,
  redirectUrl: string,
  guestId?: string,
): string {
  const url = new URL(`${apiUrl}${base}`);
  url.searchParams.set("jwt", "true");
  url.searchParams.set("redirect", redirectUrl);
  if (guestId !== undefined) {
    url.searchParams.set("guest_id", guestId);
  }
  return url.toString();
}
