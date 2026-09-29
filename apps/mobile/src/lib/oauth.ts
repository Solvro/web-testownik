import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "./api";
import { OAUTH_CLIENT_ID, OAUTH_REDIRECT_URI } from "./oauth-config";
import type { Tokens } from "./client";
import { UserFacingError } from "./user-error";

const key = "testownik.oauth.v1";
export async function saveOAuth(
  value: { verifier: string; state: string } | null,
) {
  if (Platform.OS === "web") {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } else if (value) await SecureStore.setItemAsync(key, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(key);
}
const exchanges = new Map<string, Promise<Tokens>>();
export function exchangeOAuth(params: { code: string; state: string }) {
  const id = `${params.code}:${params.state}`;
  const existing = exchanges.get(id);
  if (existing) return existing;
  const promise = (async () => {
    const raw =
      Platform.OS === "web"
        ? sessionStorage.getItem(key)
        : await SecureStore.getItemAsync(key);
    let saved: { verifier?: unknown; state?: unknown } | null = null;
    try {
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      throw new UserFacingError("oauthState");
    }
    if (
      !saved ||
      typeof saved.verifier !== "string" ||
      !saved.verifier ||
      typeof params.code !== "string" ||
      !params.code ||
      typeof params.state !== "string" ||
      !params.state ||
      params.state !== saved.state
    )
      throw new UserFacingError("oauthState");
    const result = await api.request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>(
      "oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: OAUTH_CLIENT_ID,
          redirect_uri: OAUTH_REDIRECT_URI,
          code: params.code,
          code_verifier: saved.verifier,
        }).toString(),
      },
      false,
    );
    if (
      !result ||
      typeof result.access_token !== "string" ||
      !result.access_token ||
      typeof result.refresh_token !== "string" ||
      !result.refresh_token ||
      typeof result.token_type !== "string" ||
      result.token_type.toLowerCase() !== "bearer"
    )
      throw new UserFacingError("oauthResponse");
    const tokens = {
      access: result.access_token,
      refresh: result.refresh_token,
    };
    await saveOAuth(null);
    return tokens;
  })().catch((error) => {
    exchanges.delete(id);
    throw error;
  });
  if (exchanges.size >= 5) exchanges.delete(exchanges.keys().next().value!);
  exchanges.set(id, promise);
  return promise;
}
