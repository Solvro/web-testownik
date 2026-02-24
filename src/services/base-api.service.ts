import { GUEST_COOKIE_NAME } from "@/lib/auth/constants";
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
    const fullURL = new URL(
      url,
      this.baseURL.endsWith("/") ? this.baseURL : `${this.baseURL}/`,
    );

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

    // Check if body is FormData to avoid setting Content-Type
    const isFormData = (options.body as unknown) instanceof FormData;

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    };

    try {
      let response = await fetch(fullURL, requestOptions);

      if (response.status === 401) {
        const isGuest = getCookie(GUEST_COOKIE_NAME) === "true";
        if (isGuest) {
          throw new Error("Unauthorized");
        }
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
        let errorDetail = "";
        try {
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const body = (await response.json()) as unknown;
            if (body !== null && typeof body === "object") {
              const maybeDetail = (body as { detail?: unknown }).detail;
              const maybeMessage = (body as { message?: unknown }).message;
              const fromArray =
                Array.isArray(body) && body.length > 0
                  ? (body[0] as unknown)
                  : undefined;

              const candidate = [maybeDetail, maybeMessage, fromArray].find(
                (value) => typeof value === "string" && value.trim().length > 0,
              ) as string | undefined;
              errorDetail =
                candidate === undefined
                  ? JSON.stringify(body)
                  : candidate.trim();
            }
          } else {
            const rawText = await response.text();
            const text = rawText.trim();
            if (text.length > 0) {
              errorDetail = text;
            }
          }
        } catch {
          // Ignore parsing errors and fall back to status text
        }

        const message =
          errorDetail.length > 0
            ? errorDetail
            : response.statusText || "Request failed";
        throw new Error(`${message} (${response.status.toString()})`);
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

  private async queueTokenRefresh(): Promise<boolean> {
    if (BaseApiService.refreshPromise !== null) {
      return BaseApiService.refreshPromise;
    }
    BaseApiService.refreshPromise = (async () => {
      try {
        // refresh token is stored in httpOnly cookie so to refresh
        // we need to make a request to Next.js API route
        const response = await this.fetchWithTimeout(
          "/auth/refresh",
          {
            method: "POST",
          },
          REFRESH_TOKEN_TIMEOUT_MS,
        );
        if (!response.ok) {
          if (response.status === 401) {
            try {
              const data = (await response.clone().json()) as {
                code?: string;
                ban_reason?: string | null;
              };

              if (data.code === "user_banned") {
                this.clearAuthTokens();
                if (typeof window !== "undefined") {
                  const searchParameters = new URLSearchParams();
                  searchParameters.set("error", "user_banned");
                  if (
                    data.ban_reason !== undefined &&
                    data.ban_reason !== null
                  ) {
                    searchParameters.set("ban_reason", data.ban_reason);
                  }
                  window.location.href = `/?${searchParameters.toString()}`;
                }
                return false;
              }
            } catch (error) {
              console.error(error);
            }
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
    const isGuest = getCookie(GUEST_COOKIE_NAME) === "true";
    if (isGuest) {
      return;
    }

    const token = this.getAccessToken();
    if (token !== null && isTokenExpired(token)) {
      await this.queueTokenRefresh();
    }
  }

  protected clearAuthTokens(): void {
    deleteCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
    deleteCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN);
  }

  /**
   * Refreshes the access token using the refresh token
   */
  async refreshToken(): Promise<boolean> {
    return this.queueTokenRefresh();
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
    options: { includeCredentials?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(url, {
      method: "POST",
      body:
        data !== undefined && data !== null ? JSON.stringify(data) : undefined,
      credentials: options.includeCredentials === true ? "include" : undefined,
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

  /**
   * Generic Upload request (POST with FormData)
   */
  protected async uploadFile<T>(
    url: string,
    file: File,
    fieldName = "file",
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    return this.makeRequest<T>(url, {
      method: "POST",
      body: formData,
    });
  }
}
