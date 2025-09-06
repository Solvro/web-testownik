import type { InternalAxiosRequestConfig } from "axios";

export const requestInterceptor = (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};
