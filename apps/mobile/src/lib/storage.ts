import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { TokenStore, Tokens } from "./client";

const key = "testownik.oauth-session.v2";
const legacyKey = "testownik.session.v1";
const listeners = new Set<() => void>();
let current: Tokens | null | undefined;
// Web is a development preview. Native credentials live exclusively in Keychain/Keystore.
export const tokenStore: TokenStore = {
  async get() {
    if (current !== undefined) return current;
    if (Platform.OS === "web") sessionStorage.removeItem(legacyKey);
    else await SecureStore.deleteItemAsync(legacyKey);
    const raw =
      Platform.OS === "web"
        ? sessionStorage.getItem(key)
        : await SecureStore.getItemAsync(key);
    try {
      current = raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      current = null;
    }
    return current;
  },
  async set(tokens) {
    if (Platform.OS === "web") {
      if (tokens) sessionStorage.setItem(key, JSON.stringify(tokens));
      else sessionStorage.removeItem(key);
    } else if (tokens)
      await SecureStore.setItemAsync(key, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(key);
    current = tokens;
    listeners.forEach((fn) => fn());
  },
};
export function subscribeSession(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const storage = {
  async read<T>(key: string, fallback: T): Promise<T> {
    const raw = await AsyncStorage.getItem(`testownik.v1.${key}`);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  async write<T>(key: string, value: T) {
    await AsyncStorage.setItem(`testownik.v1.${key}`, JSON.stringify(value));
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(`testownik.v1.${key}`);
  },
};
