import type { InternalAxiosRequestConfig } from "axios";
import axios, { AxiosError } from "axios";

import { SERVER_URL } from "../config";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface TokenRefreshResponse {
  access: string;
  refresh: string;
}

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (
  error: AxiosError | null,
  token: string | null = null,
) => {
  for (const prom of failedQueue) {
    if (error == null) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  }

  failedQueue = [];
};

export class RefreshTokenExpiredError extends AxiosError {
  constructor(error: AxiosError) {
    super(
      error.message,
      error.code,
      error.config,
      error.request,
      error.response,
    );
    this.name = "RefreshTokenExpiredError";
  }
}

export const responseInterceptor = async (error: AxiosError) => {
  const originalRequest = error.config as CustomAxiosRequestConfig;
  if (
    error.response != null &&
    error.response.status === 401 &&
    originalRequest._retry !== true
  ) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(async (token) => {
          originalRequest.headers.Authorization = `Bearer ${token as string}`;
          return axios(originalRequest);
        })
        .catch((error_: unknown) => {
          throw error_;
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken === null) {
      console.warn("No refresh token available");
      throw error;
    } else {
      try {
        const response = await axios.post<TokenRefreshResponse>(
          `${SERVER_URL}/token/refresh/`,
          {
            refresh: refreshToken,
          },
        );
        const newToken = response.data.access;
        const newRefreshToken = response.data.refresh;
        localStorage.setItem("access_token", newToken);
        localStorage.setItem("refresh_token", newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        isRefreshing = false;
        return await axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        isRefreshing = false;
        if ((refreshError as AxiosError).response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          console.warn("Refresh token expired, logging out");
          throw new RefreshTokenExpiredError(refreshError as AxiosError);
        }
        throw refreshError;
      }
    }
  }
  throw error;
};
