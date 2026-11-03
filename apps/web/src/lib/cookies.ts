import Cookies from "js-cookie";

export { AUTH_COOKIES as AUTH_COOKIE_NAMES } from "./auth/constants";
export function getCookie(name: string): string | null {
  const value = Cookies.get(name);
  return value ?? null;
}

export function setCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  } = {},
): void {
  const {
    maxAge = 3600,
    path = "/",
    secure = typeof window === "undefined"
      ? false
      : window.location.protocol === "https:",
    sameSite = "lax",
  } = options;

  const expires = new Date(Date.now() + maxAge * 1000);

  Cookies.set(name, value, {
    path,
    secure,
    sameSite,
    expires,
  });
}

export function deleteCookie(name: string): void {
  Cookies.remove(name);
}
