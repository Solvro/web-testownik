import type { UserData } from "@testownik/core/user/types";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { api } from "./api";
import { OAUTH_CLIENT_ID } from "./oauth-config";
import { ApiError, type Tokens } from "./client";
import { OfflineLibrary } from "./offline";
import { storage, subscribeSession, tokenStore } from "./storage";
import { UserFacingError, errorKind } from "./user-error";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry for a blip; a timeout already waited 30 s, and missing or
      // forbidden content won't appear on a second try.
      retry: (count, error) =>
        count < 1 &&
        !["timeout", "notFound", "forbidden", "signIn"].includes(
          errorKind(error),
        ),
      staleTime: 30000,
    },
    mutations: { retry: false },
  },
});
interface Session {
  user: UserData | null;
  ready: boolean;
  offline: boolean;
  pending: number;
  syncError: Error | string | null;
  library: OfflineLibrary | null;
  login(tokens: Tokens): Promise<void>;
  logout(): Promise<void>;
  sync(): Promise<void>;
  reload(confirmedUser?: UserData): Promise<void>;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<UserData | null>(null),
    [ready, setReady] = useState(false),
    [offline, setOffline] = useState(false),
    [pending, setPending] = useState(0),
    [syncError, setSyncError] = useState<Error | string | null>(null);
  const sessionGeneration = useRef(0);
  const activeUserId = useRef<UserData["id"] | null>(null);
  const setUser = useCallback((value: UserData | null) => {
    activeUserId.current = value?.id ?? null;
    updateUser(value);
  }, []);
  const userId = user?.id;
  const library = useMemo(
    () => (userId ? new OfflineLibrary(userId, storage, api) : null),
    [userId],
  );
  const reload = useCallback(
    async (confirmedUser?: UserData) => {
      const generation = ++sessionGeneration.current;
      const tokens = await tokenStore.get();
      if (!tokens) {
        setUser(null);
        setReady(true);
        return;
      }
      const cached = await storage.read<UserData | null>("last-user", null);
      if (generation !== sessionGeneration.current) return;
      if (confirmedUser && activeUserId.current !== confirmedUser.id) return;
      if (cached && !confirmedUser) {
        setUser(cached);
        setReady(true);
      }
      try {
        // Profile mutations already return the authoritative user. Reuse it so a
        // second request cannot hide a successful save behind a network failure.
        const value = confirmedUser ?? (await api.request<UserData>("user/"));
        if (
          generation !== sessionGeneration.current ||
          !(await tokenStore.get())
        )
          return;
        try {
          await storage.write("last-user", value);
        } catch {
          // A device-cache failure does not undo an acknowledged server change.
          // Discard the old snapshot rather than presenting it as the saved value.
          await storage.remove("last-user").catch(() => undefined);
        }
        const activeTokens = await tokenStore.get();
        if (generation !== sessionGeneration.current || !activeTokens) return;
        setUser(value);
      } catch (error) {
        if (generation !== sessionGeneration.current) return;
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          await tokenStore.set(null);
          setUser(null);
        } else setUser(await storage.read<UserData | null>("last-user", null));
      } finally {
        if (generation === sessionGeneration.current) setReady(true);
      }
    },
    [setUser],
  );
  useEffect(() => {
    // Hydrate the session from asynchronous secure storage and the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return subscribeSession(() => {
      void tokenStore.get().then((t) => {
        if (!t) {
          sessionGeneration.current++;
          queryClient.clear();
          setReady(true);
          setUser(null);
        }
      });
    });
  }, [reload, setUser]);
  const sync = useCallback(async () => {
    if (!library) return;
    try {
      await library.sync();
      const state = await library.read();
      setPending(state.queue.length);
      setSyncError(Object.values(state.errors)[0] ?? null);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error : new UserFacingError("connection"),
      );
      // The error above is already shown; a storage failure here keeps the count.
      await library
        .read()
        .then((state) => setPending(state.queue.length))
        .catch(() => undefined);
    }
  }, [library]);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
      if (state.isConnected) void sync();
    });
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") void sync();
    });
    // Reconcile a persisted queue on account changes; all updates follow I/O.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void sync();
    return () => {
      unsubscribe();
      listener.remove();
    };
  }, [sync]);
  const login = useCallback(
    async (tokens: Tokens) => {
      sessionGeneration.current++;
      setUser(null);
      queryClient.clear();
      await storage.remove("last-user");
      await tokenStore.set(tokens);
      await reload();
    },
    [reload, setUser],
  );
  async function logout() {
    sessionGeneration.current++;
    activeUserId.current = null;
    const tokens = await tokenStore.get();
    try {
      if (tokens)
        await api.response(
          "oauth/revoke_token/",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: tokens.refresh,
              token_type_hint: "refresh_token",
              client_id: OAUTH_CLIENT_ID,
            }).toString(),
          },
          false,
        );
    } catch {
      // Revoking is best effort: offline, signing out still clears this device
      // instead of reporting an error after the session is already gone.
    } finally {
      await tokenStore.set(null);
      await storage.remove("last-user");
      queryClient.clear();
      setUser(null);
      setPending(0);
      setSyncError(null);
    }
  }
  return (
    <QueryClientProvider client={queryClient}>
      <Context.Provider
        value={{
          user,
          ready,
          offline,
          pending,
          syncError,
          library,
          login,
          logout,
          sync,
          reload,
        }}
      >
        {children}
      </Context.Provider>
    </QueryClientProvider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Session provider missing");
  return value;
}
