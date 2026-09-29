import { fetch as expoFetch } from "expo/fetch";
import { Platform } from "react-native";

import { ApiClient } from "./client";
import { tokenStore } from "./storage";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android"
    ? "http://10.0.2.2:8000/api"
    : "http://localhost:8000/api")
).replace(/\/$/, "");
export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000")
).replace(/\/$/, "");
export const api = new ApiClient(API_URL, tokenStore);
export const ai = new ApiClient(
  WEB_URL,
  tokenStore,
  // On web this aliases window.fetch, which cannot receive ApiClient as `this`.
  ((...args) => expoFetch(...args)) as typeof fetch,
  API_URL,
);
export function listOf<T>(value: T[] | { results: T[] }): T[] {
  return Array.isArray(value) ? value : value.results;
}
