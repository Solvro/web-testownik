import axios, { InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";

import { SERVER_URL } from "../config";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (
  error: AxiosError | null,
  token: string | null = null,
) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

class RefreshTokenExpiredError extends AxiosError {
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

const responseInterceptor = async (error: AxiosError) => {
  const originalRequest = error.config as CustomAxiosRequestConfig;
  if (error.response?.status === 401 && !originalRequest._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          return axios(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        const response = await axios.post(`${SERVER_URL}/token/refresh/`, {
          refresh: refreshToken,
        });
        const newToken = response.data.access;
        const newRefreshToken = response.data.refresh;
        localStorage.setItem("access_token", newToken);
        localStorage.setItem("refresh_token", newRefreshToken);
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        processQueue(null, newToken);
        isRefreshing = false;
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        isRefreshing = false;
        if ((refreshError as AxiosError).response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          console.warn("Refresh token expired, logging out");
          return Promise.reject(
            new RefreshTokenExpiredError(refreshError as AxiosError),
          );
        }
        return Promise.reject(refreshError);
      }
    } else {
      console.warn("No refresh token available");
      return Promise.reject(error);
    }
  }
  return Promise.reject(error);
};

export default responseInterceptor;

export { RefreshTokenExpiredError };
