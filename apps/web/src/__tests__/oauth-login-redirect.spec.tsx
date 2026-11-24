import { cleanup, render, screen } from "@testing-library/react";
import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppContext } from "@/app-context";
import { LoginPrompt } from "@/components/login-prompt";
import { AuthButtons } from "@/components/navbar/auth-buttons";
import { API_URL } from "@/lib/api";
import {
  buildLoginPath,
  buildOAuthAuthorizePath,
  getHeaderLoginHref,
  splitLoginError,
} from "@/lib/auth/login-redirect";
import type { JWTPayload } from "@/lib/auth/types";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  search: "",
}));

vi.mock("@/components/app-logo", () => ({ AppLogoFull: () => null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

// The redirect ChatGPT sent: its `client_id` carries a query string of its own.
const FAILING_LOGIN_URL =
  "/login?redirect=%2Foauth%2Fauthorize%3Fresponse_type%3Dcode%26client_id%3Dhttps%253A%252F%252Fchatgpt.com%252Foauth%252F4TN8Cajh8P0r%252Fclient.json%253Ftoken_endpoint_auth_method%253Dnone%26redirect_uri%3Dhttps%253A%252F%252Fchatgpt.com%252Fconnector%252Foauth%252F4TN8Cajh8P0r%26scope%3Dquizzes%253Aread%2Bquizzes%253Awrite%2Bstudy%253Aread%2Bstudy%253Awrite%2Buser%253Aread%26code_challenge%3DCkfm2akJwOaM-vOMxeRyFOkqGnhNuLVZjcjixqZwtpU%26code_challenge_method%3DS256%26resource%3Dhttps%253A%252F%252Ftestownik.solvro.pl%252Fapi%252Fmcp%26state%3Doauth_s_6b05a2260f8c8191aa863849eeb74773%26ui_locales%3Den-US";

const AUTHORIZATION_PARAMETERS = {
  response_type: "code",
  client_id:
    "https://chatgpt.com/oauth/4TN8Cajh8P0r/client.json?token_endpoint_auth_method=none",
  redirect_uri: "https://chatgpt.com/connector/oauth/4TN8Cajh8P0r",
  scope: "quizzes:read quizzes:write study:read study:write user:read",
  code_challenge: "Ckfm2akJwOaM-vOMxeRyFOkqGnhNuLVZjcjixqZwtpU",
  code_challenge_method: "S256",
  resource: "https://testownik.solvro.pl/api/mcp",
  state: "oauth_s_6b05a2260f8c8191aa863849eeb74773",
  ui_locales: "en-US",
};

const loginSearch = FAILING_LOGIN_URL.slice("/login?".length);

function authorizationParametersOf(url: string) {
  const { pathname, searchParams } = new URL(url, window.location.origin);
  expect(pathname).toBe("/oauth/authorize");
  return Object.fromEntries(searchParams);
}

/** Base UI gives a `render`-ed link the button role. */
function loginLink(name: string): HTMLAnchorElement {
  const link = screen.getByText(name).closest("a");
  if (link === null) {
    throw new Error(`No link named ${name}`);
  }
  return link;
}

function backendRedirectOf(link: HTMLElement) {
  const redirect = new URL(link.getAttribute("href") ?? "").searchParams.get(
    "redirect",
  );
  expect(redirect).not.toBeNull();
  return redirect ?? "";
}

function renderOnLogin(ui: React.ReactNode, user: JWTPayload | null = null) {
  navigation.pathname = "/login";
  navigation.search = loginSearch;
  return render(
    <AppContext.Provider
      value={{
        isAuthenticated: user !== null,
        user,
        checkPermission: () => false,
      }}
    >
      {ui}
    </AppContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("OAuth authorize redirect through login", () => {
  it("builds the same login URL the authorize page redirected to", () => {
    expect(
      buildLoginPath(buildOAuthAuthorizePath(AUTHORIZATION_PARAMETERS)),
    ).toBe(FAILING_LOGIN_URL);
  });

  it.each([
    ["Zaloguj przez USOS", "/login/usos/"],
    ["Zaloguj się przez e-mail", "/login/"],
  ])("%s returns to the exact authorize URL", (name, backendPath) => {
    renderOnLogin(<LoginPrompt />);

    const link = loginLink(name);

    expect(link.getAttribute("href")).toMatch(
      new RegExp(String.raw`^${API_URL}${backendPath}\?`),
    );
    expect(authorizationParametersOf(backendRedirectOf(link))).toEqual(
      AUTHORIZATION_PARAMETERS,
    );
  });

  it("does not offer a guest account, which cannot connect apps", () => {
    renderOnLogin(<LoginPrompt />);

    expect(
      screen.queryByRole("button", { name: "Kontynuuj jako gość" }),
    ).toBeNull();
  });

  it("keeps the redirect on the header login button", () => {
    renderOnLogin(<AuthButtons />);

    const href = loginLink("Zaloguj się").getAttribute("href") ?? "";
    const redirect = new URL(href, window.location.origin).searchParams.get(
      "redirect",
    );

    expect(authorizationParametersOf(redirect ?? "")).toEqual(
      AUTHORIZATION_PARAMETERS,
    );
  });

  it("keeps the redirect on the header login button for a guest", () => {
    renderOnLogin(<AuthButtons />, {
      account_type: ACCOUNT_TYPE.GUEST,
    } as JWTPayload);

    expect(loginLink("Zaloguj się").getAttribute("href")).toBe(
      FAILING_LOGIN_URL,
    );
  });

  it("moves a sign-in error off the authorize URL onto the login page", () => {
    const { parameters, loginError } = splitLoginError({
      ...AUTHORIZATION_PARAMETERS,
      error: "usos_unavailable",
    });

    const loginUrl = new URL(
      buildLoginPath(buildOAuthAuthorizePath(parameters), loginError),
      window.location.origin,
    );

    expect(loginUrl.searchParams.get("error")).toBe("usos_unavailable");
    expect(
      authorizationParametersOf(loginUrl.searchParams.get("redirect") ?? ""),
    ).toEqual(AUTHORIZATION_PARAMETERS);
  });
});

describe("getHeaderLoginHref", () => {
  it("returns to the current page with its query", () => {
    expect(getHeaderLoginHref("/quizzes", "tab=shared")).toBe(
      "/login?redirect=%2Fquizzes%3Ftab%3Dshared",
    );
  });

  it("links the landing and a bare login page to plain login", () => {
    expect(getHeaderLoginHref("/", "")).toBe("/login");
    expect(getHeaderLoginHref("/login", "")).toBe("/login");
  });
});
