import { OAUTH_CLIENT_ID } from "./oauth-config";
import type { UserErrorCode } from "./user-error";
export interface Tokens {
  access: string;
  refresh: string;
}
export interface TokenStore {
  session(): AbortSignal;
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null, expectedSession?: AbortSignal): Promise<void>;
}
export interface ApiRequestOptions extends RequestInit {
  /** Covers headers and body, including when a caller supplies cancellation. */
  timeoutMs?: number;
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
const refreshes = new WeakMap<AbortSignal, Promise<Tokens>>();
function assertSession(session: AbortSignal) {
  if (session.aborted)
    throw new ApiError(
      401,
      "Sesja została zakończona.",
      undefined,
      "signedOut",
    );
}
function throwRequestError(
  error: unknown,
  session: AbortSignal | null,
  caller: AbortSignal | null | undefined,
  signal?: AbortSignal,
): never {
  if (session) assertSession(session);
  if (caller?.aborted) throw caller.reason;
  if (signal?.aborted && signal.reason?.name === "TimeoutError")
    throw new ApiError(0, "The request took too long.", undefined, "timeout");
  throw error;
}
/** A cancelled caller leaves the shared rotation available to other requests. */
function waitForRefresh<T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
export class ApiClient {
  constructor(
    public baseUrl: string,
    private store: TokenStore,
    private fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
    private refreshBaseUrl: string = baseUrl,
    private owner?: AbortSignal,
  ) {}
  /** Long-running work such as an offline queue must keep its original owner. */
  forSession(session = this.owner ?? this.store.session()) {
    return new ApiClient(
      this.baseUrl,
      this.store,
      this.fetcher,
      this.refreshBaseUrl,
      this.owner ?? session,
    );
  }
  async refresh(session = this.owner ?? this.store.session()): Promise<Tokens> {
    assertSession(session);
    const pending = refreshes.get(session);
    if (pending) return pending;
    const signal = AbortSignal.any([session, AbortSignal.timeout(20000)]);
    const refreshing = (async () => {
      const original = await this.store.get();
      assertSession(session);
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
        signal,
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
          await this.store.set(null, session);
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
      if (
        session.aborted ||
        (await this.store.get())?.refresh !== original.refresh
      )
        throw new ApiError(
          401,
          "Sesja została zakończona.",
          undefined,
          "signedOut",
        );
      await this.store.set(tokens, session);
      return tokens;
    })()
      .catch((error: unknown) =>
        throwRequestError(error, session, null, signal),
      )
      .finally(() => {
        refreshes.delete(session);
      });
    refreshes.set(session, refreshing);
    return refreshing;
  }
  async request<T>(
    path: string,
    options: ApiRequestOptions = {},
    authenticated = true,
  ): Promise<T> {
    const session = authenticated ? (this.owner ?? this.store.session()) : null;
    let bodySignal: AbortSignal | undefined;
    try {
      const { response, signal } = await this.sendResponse(
        path,
        options,
        authenticated,
      );
      bodySignal = signal;
      if (response.status === 204) return undefined as T;
      const value = (await response.json()) as T;
      // Headers can arrive before a slow response body. Its result still belongs
      // to the login that started the request.
      if (session) assertSession(session);
      return value;
    } catch (error) {
      return throwRequestError(error, session, options.signal, bodySignal);
    }
  }
  async response(
    path: string,
    options: ApiRequestOptions = {},
    authenticated = true,
  ): Promise<Response> {
    return (await this.sendResponse(path, options, authenticated)).response;
  }
  private async sendResponse(
    path: string,
    options: ApiRequestOptions,
    authenticated: boolean,
  ): Promise<{ response: Response; signal: AbortSignal }> {
    const session = authenticated ? (this.owner ?? this.store.session()) : null;
    const {
      timeoutMs = options.body instanceof FormData ? 120000 : 30000,
      ...requestOptions
    } = options;
    // The combined signal stays attached while consumers read the body.
    // A query's cancellation signal must not disable the request deadline.
    const signal = AbortSignal.any([
      AbortSignal.timeout(timeoutMs),
      ...(options.signal ? [options.signal] : []),
      ...(session ? [session] : []),
    ]);
    const send = (tokens: Tokens | null) => {
      if (session) assertSession(session);
      if (signal.aborted) throw signal.reason;
      const headers = new Headers(options.headers);
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
      )
        headers.set("Content-Type", "application/json");
      if (tokens) headers.set("Authorization", `Bearer ${tokens.access}`);
      return this.fetcher(`${this.baseUrl}/${path.replace(/^\//, "")}`, {
        ...requestOptions,
        headers,
        signal,
      });
    };
    try {
      const original = authenticated ? await this.store.get() : null;
      let result = await send(original);
      if (session) assertSession(session);
      if (result.status === 401 && session && original) {
        const current = await this.store.get();
        assertSession(session);
        if (signal.aborted) throw signal.reason;
        // A sibling request may already have rotated this same session.
        const tokens =
          current && current.access !== original.access
            ? current
            : await waitForRefresh(this.refresh(session), signal);
        result = await send(tokens);
        assertSession(session);
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
      return { response: result, signal };
    } catch (error) {
      return throwRequestError(error, session, options.signal, signal);
    }
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
