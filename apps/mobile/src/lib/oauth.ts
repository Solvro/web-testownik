import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "./api";
import { OAUTH_CLIENT_ID, OAUTH_REDIRECT_URI } from "./oauth-config";
import type { Tokens } from "./client";
import { UserFacingError } from "./user-error";

const key = "testownik.oauth.v1";
export type OAuthFlow = { verifier: string; state: string };
let revision = 0;
let storageQueue: Promise<unknown> = Promise.resolve();
function withStorage<T>(operation: () => Promise<T> | T): Promise<T> {
  const pending = storageQueue.then(operation);
  storageQueue = pending.catch(() => undefined);
  return pending;
}
function readOAuth() {
  return Platform.OS === "web"
    ? sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function writeOAuth(value: OAuthFlow | null) {
  if (Platform.OS === "web") {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } else if (value) await SecureStore.setItemAsync(key, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(key);
}
export function saveOAuth(value: OAuthFlow | null) {
  revision += 1;
  return withStorage(() => writeOAuth(value));
}
// Browser cancellations and token responses may finish after a newer login starts.
// Serialize the ownership check and removal so native storage cannot reorder them.
export function clearOAuth(flow: OAuthFlow, expectedRevision = revision) {
  return withStorage(async () => {
    if (revision !== expectedRevision) return false;
    const raw = await readOAuth();
    let saved: OAuthFlow | null;
    try {
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      return false;
    }
    if (
      revision !== expectedRevision ||
      saved?.state !== flow.state ||
      saved?.verifier !== flow.verifier
    )
      return false;
    await writeOAuth(null);
    if (revision !== expectedRevision) return false;
    revision += 1;
    return true;
  });
}
const exchanges = new Map<string, Promise<Tokens>>();
export function exchangeOAuth(params: { code: string; state: string }) {
  const id = `${params.code}:${params.state}`;
  const existing = exchanges.get(id);
  if (existing) return existing;
  const expectedRevision = revision;
  const promise = (async () => {
    const raw = await withStorage(readOAuth);
    let saved: { verifier?: unknown; state?: unknown } | null = null;
    try {
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      throw new UserFacingError("oauthState");
    }
    if (
      revision !== expectedRevision ||
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
    if (
      !(await clearOAuth(
        { state: params.state, verifier: saved.verifier },
        expectedRevision,
      )) ||
      revision !== expectedRevision + 1
    )
      throw new UserFacingError("oauthState");
    return tokens;
  })().finally(() => {
    if (exchanges.get(id) === promise) exchanges.delete(id);
  });
  if (exchanges.size >= 5) exchanges.delete(exchanges.keys().next().value!);
  exchanges.set(id, promise);
  return promise;
}
