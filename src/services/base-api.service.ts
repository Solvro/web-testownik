import { isTokenExpired } from "@/lib/auth/jwt-utils";
import { AUTH_COOKIE_NAMES, deleteCookie, getCookie } from "@/lib/cookies";

import type { ApiError, ApiResponse } from "./types";

// Abort refresh attempts if they exceed this duration
const REFRESH_TOKEN_TIMEOUT_MS = 10_000; // 10s

/**
 * Base API service class that provides common functionality for API calls.
 * Uses cookies for token storage to support SSR.
 */
export class BaseApiService {
  // Single shared refresh promise across all service instances
  private static refreshPromise: Promise<boolean> | null = null;

  constructor(
    protected baseURL: string,
    protected defaultHeaders: Record<string, string> = {},
    protected accessToken?: string,
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
   * Get authorization headers from cookie
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
   * Get access token from cookie
   */
  private getAccessToken(): string | null {
    if (this.accessToken !== undefined) {
      return this.accessToken;
    }
    const token = getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
    if (token === null) {
      return null;
    }
    if (token.trim() === "") {
      return null;
    }
    return token;
  }

  /**
   * Get a valid access token or null
   */
  private getValidAccessToken(): string | null {
    const token = this.getAccessToken();
    if (token === null) {
      return null;
    }

    if (isTokenExpired(token)) {
      return null;
    }
    return token;
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
   * Check if we can attempt a token refresh (have refresh token in cookie)
   */
  private canAttemptRefresh(): boolean {
    const refreshToken = getCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN);
    return refreshToken !== null && refreshToken.trim() !== "";
  }

  private async queueTokenRefresh(): Promise<boolean> {
    if (BaseApiService.refreshPromise !== null) {
      return BaseApiService.refreshPromise;
    }
    BaseApiService.refreshPromise = (async () => {
      try {
        const response = await this.fetchWithTimeout(
          "/auth/refresh",
          {
            method: "POST",
            credentials: "include",
          },
          REFRESH_TOKEN_TIMEOUT_MS,
        );
        if (!response.ok) {
          if (response.status === 401) {
            this.clearAuthTokens();
          }
          return false;
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
    const token = this.getAccessToken();
    if (token === null) {
      await this.queueTokenRefresh();
      return;
    }
    if (isTokenExpired(token)) {
      await this.queueTokenRefresh();
    }
  }

  clearAuthTokens(): void {
    deleteCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
    deleteCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN);
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
