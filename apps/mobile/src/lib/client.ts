import { OAUTH_CLIENT_ID } from "./oauth-config";
import type { UserErrorCode } from "./user-error";
export interface Tokens {
  access: string;
  refresh: string;
}
export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null): Promise<void>;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
    public code?: UserErrorCode,
  ) {
    super(message);
  }
}
const refreshes = new WeakMap<TokenStore, Promise<Tokens>>();
export class ApiClient {
  constructor(
    public baseUrl: string,
    private store: TokenStore,
    private fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
    private refreshBaseUrl: string = baseUrl,
  ) {}
  async refresh(): Promise<Tokens> {
    const pending = refreshes.get(this.store);
    if (pending) return pending;
    const refreshing = (async () => {
      const original = await this.store.get();
      if (!original)
        throw new ApiError(401, "Zaloguj się ponownie.", undefined, "signIn");
      const result = await this.fetcher(`${this.refreshBaseUrl}/oauth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: original.refresh,
          client_id: OAUTH_CLIENT_ID,
        }).toString(),
        signal: AbortSignal.timeout(20000),
      });
      if (!result.ok) {
        const failure = ((await result.json().catch(() => null)) ?? {}) as {
          error?: string;
        };
        if (
          (result.status === 401 ||
            result.status === 403 ||
            (result.status === 400 && failure.error === "invalid_grant")) &&
          (await this.store.get())?.refresh === original.refresh
        )
          await this.store.set(null);
        throw new ApiError(
          result.status,
          "Nie udało się odnowić sesji.",
          undefined,
          "refresh",
        );
      }
      const resultTokens = (await result.json()) as {
        access_token: string;
        refresh_token: string;
        token_type: string;
      };
      if (
        !resultTokens ||
        typeof resultTokens.access_token !== "string" ||
        !resultTokens.access_token ||
        typeof resultTokens.refresh_token !== "string" ||
        !resultTokens.refresh_token ||
        typeof resultTokens.token_type !== "string" ||
        resultTokens.token_type.toLowerCase() !== "bearer"
      )
        throw new ApiError(
          401,
          "Invalid OAuth token response.",
          undefined,
          "oauthResponse",
        );
      const tokens: Tokens = {
        access: resultTokens.access_token,
        refresh: resultTokens.refresh_token,
      };
      // A logout or account switch during refresh must not restore the previous session.
      if ((await this.store.get())?.refresh !== original.refresh)
        throw new ApiError(
          401,
          "Sesja została zakończona.",
          undefined,
          "signedOut",
        );
      await this.store.set(tokens);
      return tokens;
    })().finally(() => {
      refreshes.delete(this.store);
    });
    refreshes.set(this.store, refreshing);
    return refreshing;
  }
  async request<T>(
    path: string,
    options: RequestInit = {},
    authenticated = true,
  ): Promise<T> {
    const response = await this.response(path, options, authenticated);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  async response(
    path: string,
    options: RequestInit = {},
    authenticated = true,
  ): Promise<Response> {
    const send = async () => {
      const headers = new Headers(options.headers);
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
      )
        headers.set("Content-Type", "application/json");
      const tokens = authenticated ? await this.store.get() : null;
      if (tokens) headers.set("Authorization", `Bearer ${tokens.access}`);
      return this.fetcher(`${this.baseUrl}/${path.replace(/^\//, "")}`, {
        ...options,
        headers,
        signal: options.signal ?? AbortSignal.timeout(30000),
      });
    };
    let result = await send();
    if (result.status === 401 && authenticated && (await this.store.get())) {
      await this.refresh();
      result = await send();
    }
    if (!result.ok) {
      const payload: unknown = await result.json().catch(() => null);
      const body =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : {};
      const fallback =
        result.status === 503
          ? "Przerwa techniczna. Spróbuj ponownie później."
          : result.status === 429
            ? "Zbyt wiele prób. Odczekaj chwilę."
            : "Nie udało się wykonać operacji.";
      throw new ApiError(
        result.status,
        typeof body.detail === "string"
          ? body.detail
          : typeof body.error === "string"
            ? body.error
            : fallback,
        body,
        typeof body.detail === "string" || typeof body.error === "string"
          ? undefined
          : result.status === 503
            ? "maintenance"
            : result.status === 429
              ? "throttled"
              : "operation",
      );
    }
    return result;
  }
  post<T>(path: string, body: unknown = {}, authenticated = true) {
    return this.request<T>(
      path,
      { method: "POST", body: JSON.stringify(body) },
      authenticated,
    );
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }
  delete<T = void>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}
