import type { ApiError, ApiResponse } from "./types";
import { STORAGE_KEYS } from "./types";

// Refresh 5 minutes before the access token actually expires
const ACCESS_TOKEN_EARLY_REFRESH_MS = 5 * 60 * 1000; // 5 min
// Abort refresh attempts if they exceed this duration
const REFRESH_TOKEN_TIMEOUT_MS = 10 * 1000; // 10s

/**
 * Base API service class that provides common functionality for API calls
 */
export class BaseApiService {
  // Single shared refresh promise across all service instances
  private static refreshPromise: Promise<boolean> | null = null;

  constructor(
    protected baseURL: string,
    protected defaultHeaders: Record<string, string> = {},
  ) {}

  /**
   * Handle API response and extract data
   */
  protected handleResponse<T>(response: Response, data: T): ApiResponse<T> {
    return {
      data,
      status: response.status,
      message: response.statusText,
    };
  }

  /**
   * Handle API errors and convert to ApiError
   */
  protected handleError(_error: unknown): ApiError {
    if (_error instanceof Error) {
      return {
        message: _error.message,
        code: "REQUEST_FAILED",
      };
    }
    return {
      message: "An error occurred",
      code: "UNKNOWN_ERROR",
    };
  }

  /**
   * Build URL with query parameters
   */
  private buildURL(url: string, parameters?: Record<string, unknown>): string {
    const fullURL = new URL(url, this.baseURL);

    if (parameters !== undefined) {
      for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined && value !== null) {
          const stringValue =
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            typeof value === "object" ? JSON.stringify(value) : String(value);
          fullURL.searchParams.append(key, stringValue);
        }
      }
    }

    return fullURL.toString();
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.defaultHeaders };
    const accessToken = this.getValidAccessToken();
    if (accessToken !== null) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }

  /**
   * Make HTTP request with fetch
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const fullURL = this.buildURL(url);

    // Ensure token is fresh (or refreshed early) before building headers
    await this.ensureFreshToken();
    let headers = this.getAuthHeaders();
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    };

    try {
      let response = await fetch(fullURL, requestOptions);

      if (response.status === 401 && this.canAttemptRefresh()) {
        const refreshed = await this.queueTokenRefresh();
        if (refreshed) {
          headers = this.getAuthHeaders();
          requestOptions.headers = {
            ...(requestOptions.headers as Record<string, string>),
            ...headers,
          };
          response = await fetch(fullURL, requestOptions);
        }
      }

      if (!response.ok) {
        throw new Error(
          `HTTP ${String(response.status)}: ${response.statusText}`,
        );
      }

      if (response.status === 204) {
        // No Content
        return this.handleResponse(response, {} as T);
      }

      const data = (await response.json()) as T;
      return this.handleResponse(response, data);
    } catch (error) {
      const apiError = this.handleError(error);
      throw new Error(apiError.message);
    }
  }

  /**
   * Get a still-valid access token or null (does not trigger refresh here).
   */
  private getValidAccessToken(): string | null {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token == null || token.trim() === "") {
        return null;
      }
      const expiresAtRaw = localStorage.getItem(
        STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT,
      );
      if (expiresAtRaw == null) {
        return token; // no info, assume valid
      }
      const expiresAt = Number(expiresAtRaw);
      if (Number.isNaN(expiresAt)) {
        return token;
      }
      const now = Date.now();
      if (now >= expiresAt) {
        return null; // expired
      }
      return token; // still valid
    } catch {
      return null;
    }
  }

  private canAttemptRefresh(): boolean {
    return (
      localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) !== null &&
      localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) !== ""
    );
  }

  private async queueTokenRefresh(): Promise<boolean> {
    if (!this.canAttemptRefresh()) {
      return false;
    }
    if (BaseApiService.refreshPromise !== null) {
      return BaseApiService.refreshPromise;
    }
    const refresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (refresh === null || refresh.trim() === "") {
      return false;
    }
    BaseApiService.refreshPromise = (async () => {
      try {
        const response = await this.fetchWithTimeout(
          new URL("/token/refresh/", this.baseURL).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
          },
          REFRESH_TOKEN_TIMEOUT_MS,
        );
        if (!response.ok) {
          if (response.status === 401) {
            this.clearAuthTokens();
          }
          return false;
        }
        const data = (await response.json()) as {
          access: string;
          refresh?: string;
          expires_in?: number; // seconds (optional)
        };
        if (data.access) {
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access);
          const expiresInMs = (data.expires_in ?? 3600) * 1000; // default 1h
          localStorage.setItem(
            STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT,
            (Date.now() + expiresInMs).toString(),
          );
        }
        if (data.refresh !== undefined && data.refresh.trim() !== "") {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh);
        }
        return true;
      } catch {
        return false;
      } finally {
        BaseApiService.refreshPromise = null;
      }
    })();
    return BaseApiService.refreshPromise;
  }

  private async fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        // Treat timeout as failure
        throw new Error("Refresh request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.canAttemptRefresh()) {
      return;
    }
    const expiresAtRaw = localStorage.getItem(
      STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT,
    );
    if (expiresAtRaw == null) {
      return; // no expiry info
    }
    const expiresAt = Number(expiresAtRaw);
    if (Number.isNaN(expiresAt)) {
      return;
    }
    const now = Date.now();
    if (now >= expiresAt) {
      // Already expired: block until refreshed
      await this.queueTokenRefresh();
      return;
    }
    if (expiresAt - now <= ACCESS_TOKEN_EARLY_REFRESH_MS) {
      // Early refresh window: ensure only one refresh; wait for it so request uses new token
      await this.queueTokenRefresh();
    }
  }

  protected clearAuthTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Generic GET request
   */
  protected async get<T>(
    url: string,
    parameters?: Record<string, unknown>,
  ): Promise<ApiResponse<T>> {
    const fullURL = this.buildURL(url, parameters);
    return this.makeRequest<T>(fullURL, { method: "GET" });
  }

  /**
   * Generic POST request
   */
  protected async post<T>(
    url: string,
    data?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: "POST",
      body:
        data !== undefined && data !== null ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Generic PUT request
   */
  protected async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: "PUT",
      body:
        data !== undefined && data !== null ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Generic PATCH request
   */
  protected async patch<T>(
    url: string,
    data?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: "PATCH",
      body:
        data !== undefined && data !== null ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Generic DELETE request
   */
  protected async delete<T = void>(url: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, { method: "DELETE" });
  }
}
