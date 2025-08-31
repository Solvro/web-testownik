import { InternalAxiosRequestConfig } from "axios";

const requestInterceptor = (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
};

export default requestInterceptor;
