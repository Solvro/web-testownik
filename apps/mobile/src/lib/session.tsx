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
import { OfflineLibrary, subscribeOfflineMediaChanges } from "./offline";
import { collectOfflineImages, removeQuizImages } from "./offline-images";
import {
  storage,
  subscribeAccountDeletion,
  subscribeSession,
  tokenStore,
} from "./storage";
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
interface AccountDeletionRecovery {
  ownerId: string;
  busy: boolean;
  error: unknown;
  canSignIn: boolean;
}
interface DeletionTarget {
  session: AbortSignal | null;
  run: Promise<void> | null;
}
interface Session {
  user: UserData | null;
  ready: boolean;
  initializationError: unknown;
  accountDeletion: AccountDeletionRecovery | null;
  offline: boolean;
  pending: number;
  syncError: Error | string | null;
  library: OfflineLibrary | null;
  login(tokens: Tokens): Promise<void>;
  logout(): Promise<void>;
  finishAccountDeletion(ownerId: string): Promise<void>;
  leaveAccountDeletionRecovery(ownerId: string): Promise<void>;
  sync(): Promise<void>;
  reload(confirmedUser?: UserData): Promise<void>;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<UserData | null>(null),
    [ready, setReady] = useState(false),
    [initializationError, setInitializationError] = useState<unknown>(null),
    [offline, setOffline] = useState(false),
    [pending, setPending] = useState(0),
    [syncError, setSyncError] = useState<Error | string | null>(null);
  const [accountDeletions, setAccountDeletions] = useState<
    ReadonlyMap<string, AccountDeletionRecovery>
  >(new Map());
  const [dismissedDeletions, setDismissedDeletions] = useState<
    ReadonlySet<string>
  >(new Set());
  const deletionTargets = useRef(new Map<string, DeletionTarget>());
  const sessionGeneration = useRef(0);
  const activeUserId = useRef<UserData["id"] | null>(null);
  const setUser = useCallback((value: UserData | null) => {
    activeUserId.current = value?.id ?? null;
    updateUser(value);
  }, []);
  const userId = user?.id;
  const sessionSignal = tokenStore.session();
  const library = useMemo(
    () =>
      userId
        ? new OfflineLibrary(userId, storage, api.forSession(sessionSignal))
        : null,
    [userId, sessionSignal],
  );
  const cleanupDeletedAccount = useCallback(
    async (
      ownerId: string,
      credentialSession: () => AbortSignal | null,
      credentialsEnding?: (session: AbortSignal) => void,
    ) => {
      // Purge first so a device-storage failure can be retried on the deletion
      // screen. The marker also blocks drafts flushing after this screen exits.
      const quizzes = await storage.purgeDeletedAccount(ownerId);
      for (const quiz of quizzes) await removeQuizImages(quiz);
      // Keep the profile until credential clearing succeeds: a relaunch can
      // still associate failed Keychain/Keystore cleanup with its deleted owner.
      // A background request may already have attempted a failed token clear
      // while the same deleted owner is still active. Its rotated signal still
      // belongs to that owner; a new login first clears activeUserId.
      const currentCredentialSession = credentialSession();
      const ownedSession =
        currentCredentialSession && activeUserId.current === ownerId
          ? tokenStore.session()
          : currentCredentialSession;
      if (ownedSession && ownedSession === tokenStore.session()) {
        const clearing = tokenStore.set(null, ownedSession);
        const clearedSession = tokenStore.session();
        credentialsEnding?.(clearedSession);
        try {
          await clearing;
        } catch (error) {
          if (clearedSession === tokenStore.session()) {
            queryClient.clear();
            setUser(null);
            setInitializationError(error);
            setReady(true);
          }
          throw error;
        }
        if (clearedSession === tokenStore.session()) {
          queryClient.clear();
          setUser(null);
          setPending(0);
          setSyncError(null);
        }
      }
      // End this account's credentials even if another owner's unreadable
      // references prevent a safe media sweep. Keep the durable marker until
      // all owned cleanup succeeds so retry cannot falsely acknowledge it.
      await collectOfflineImages();
      // Conditional removal preserves a different account that signed in while
      // this owner's purge was waiting for device storage.
      await storage.removeLastUser(ownerId);
      await storage.completeAccountDeletion(ownerId);
    },
    [setUser],
  );
  const finishAccountDeletion = useCallback(
    (ownerId: string, expectedSession?: AbortSignal | null) => {
      let target = deletionTargets.current.get(ownerId);
      if (!target) {
        target = {
          session:
            expectedSession !== undefined
              ? expectedSession
              : activeUserId.current === ownerId
                ? tokenStore.session()
                : null,
          run: null,
        };
        deletionTargets.current.set(ownerId, target);
      }
      // An orphan's first attempt could not identify its credentials. Once
      // user/ confirms that owner, attach only this still-current session.
      if (
        target.session === null &&
        expectedSession &&
        expectedSession === tokenStore.session()
      )
        target.session = expectedSession;
      if (target.run) return target.run;
      const currentTarget = target;
      // A confirmed server deletion owns recovery above the navigator. Leaving
      // the original screen cannot reopen protected content while device data
      // or credentials still need clearing.
      setAccountDeletions((previous) =>
        new Map(previous).set(ownerId, {
          ownerId,
          busy: true,
          error: null,
          canSignIn: false,
        }),
      );
      const run = (async () => {
        try {
          await cleanupDeletedAccount(
            ownerId,
            () => currentTarget.session,
            (next) => {
              // A failed secure clear rotates the signal before it rejects.
              // Retain that signal so retry clears the same credentials, while
              // a later login remains protected by the existing session guard.
              currentTarget.session = next;
            },
          );
          deletionTargets.current.delete(ownerId);
          setAccountDeletions((previous) => {
            const next = new Map(previous);
            next.delete(ownerId);
            return next;
          });
          if (
            currentTarget.session === tokenStore.session() ||
            activeUserId.current === null
          ) {
            setInitializationError(null);
            setReady(true);
          }
        } catch (error) {
          let canSignIn = false;
          try {
            canSignIn =
              !(await tokenStore.get()) && activeUserId.current === null;
          } catch {
            // An unreadable credential store cannot establish safe sign-in.
          }
          setAccountDeletions((previous) =>
            new Map(previous).set(ownerId, {
              ownerId,
              busy: false,
              error,
              canSignIn,
            }),
          );
        } finally {
          currentTarget.run = null;
        }
      })();
      currentTarget.run = run;
      return run;
    },
    [cleanupDeletedAccount],
  );
  const leaveAccountDeletionRecovery = useCallback(async (ownerId: string) => {
    const signal = tokenStore.session();
    const tokens = await tokenStore.get();
    if (
      signal !== tokenStore.session() ||
      tokens ||
      activeUserId.current !== null
    )
      return;
    // Retain the marker and retry target. Another account can sign in without
    // treating incomplete cleanup as success or exposing this owner's data.
    setDismissedDeletions((previous) => new Set(previous).add(ownerId));
  }, []);
  useEffect(
    () =>
      subscribeAccountDeletion((ownerId) => {
        // Only a verified durable deletion reaches this notification. A
        // different signed-in account keeps its session and navigation.
        if (activeUserId.current === ownerId)
          void finishAccountDeletion(ownerId, tokenStore.session());
      }),
    [finishAccountDeletion],
  );
  const reload = useCallback(
    async (confirmedUser?: UserData) => {
      const generation = ++sessionGeneration.current;
      const originalSession = tokenStore.session();
      let cleanupSession: AbortSignal | null = null;
      const stillCurrent = () =>
        (generation === sessionGeneration.current &&
          originalSession === tokenStore.session()) ||
        (cleanupSession !== null && cleanupSession === tokenStore.session());
      const credentialsEnding = (signal: AbortSignal) => {
        cleanupSession = signal;
      };
      if (!confirmedUser) setReady(false);
      setInitializationError(null);
      try {
        const tokens = await tokenStore.get();
        if (!stillCurrent()) return;
        const cached = confirmedUser
          ? null
          : await storage.read<UserData | null>("last-user", null);
        const pendingOwners = await storage.pendingAccountDeletions();
        const deletedOwners = await storage.accountDeletionOwners();
        if (!stillCurrent()) return;
        if (cached && deletedOwners.includes(cached.id)) {
          await finishAccountDeletion(cached.id, originalSession);
          return;
        }
        // Recover markers even after credentials and last-user were removed.
        // If identity is unknown, defer orphan failures until user/ identifies
        // the account; a different account must remain usable after login.
        for (const ownerId of pendingOwners) {
          await finishAccountDeletion(ownerId, null);
          if (!stillCurrent()) return;
        }
        if (!tokens) {
          setUser(null);
          return;
        }
        if (confirmedUser && activeUserId.current !== confirmedUser.id) return;
        if (cached && !confirmedUser) {
          const deleted = (await storage.accountDeletionOwners()).includes(
            cached.id,
          );
          if (!stillCurrent()) return;
          if (deleted) {
            await finishAccountDeletion(cached.id, originalSession);
            return;
          }
          setUser(cached);
          setReady(true);
        }
        let value: UserData;
        try {
          // Profile mutations already returned the authoritative account.
          value =
            confirmedUser ??
            (await api.forSession(originalSession).request<UserData>("user/"));
        } catch (error) {
          if (!stillCurrent()) return;
          if (error instanceof ApiError && error.status === 401) {
            const clearing = tokenStore.set(null, originalSession);
            credentialsEnding(tokenStore.session());
            await clearing;
            await storage.removeLastUser(cached?.id ?? "");
            if (stillCurrent()) setUser(null);
          } else {
            const fallback = await storage.read<UserData | null>(
              "last-user",
              null,
            );
            if (!fallback) throw error;
            const deleted = (await storage.accountDeletionOwners()).includes(
              fallback.id,
            );
            if (!stillCurrent()) return;
            if (deleted) {
              await finishAccountDeletion(fallback.id, originalSession);
              return;
            }
            setUser(fallback);
          }
          return;
        }
        const currentTokens = await tokenStore.get();
        if (!stillCurrent() || !currentTokens) return;
        // A fresh login can identify the deleted owner only after user/ returns.
        // Never mount its protected screens, even if an earlier purge succeeded.
        const deleted = (await storage.accountDeletionOwners()).includes(
          value.id,
        );
        if (!stillCurrent()) return;
        if (deleted) {
          await finishAccountDeletion(value.id, originalSession);
          return;
        }
        try {
          await storage.write("last-user", value, stillCurrent);
        } catch {
          // Device caching does not undo an acknowledged server profile save.
          await storage.removeLastUser(value.id).catch(() => undefined);
        }
        const finalTokens = await tokenStore.get();
        if (!stillCurrent() || !finalTokens) return;
        if ((await storage.accountDeletionOwners()).includes(value.id)) {
          if (stillCurrent())
            await finishAccountDeletion(value.id, originalSession);
          return;
        }
        if (!stillCurrent()) return;
        setUser(value);
      } catch (error) {
        if (stillCurrent()) setInitializationError(error);
      } finally {
        if (stillCurrent()) setReady(true);
      }
    },
    [setUser, finishAccountDeletion],
  );
  useEffect(() => {
    // Hydrate the session from asynchronous secure storage and the API.
    void reload();
    return subscribeSession(() => {
      const signal = tokenStore.session();
      void tokenStore.get().then((t) => {
        if (signal !== tokenStore.session()) return;
        if (!t) {
          sessionGeneration.current++;
          queryClient.clear();
          setReady(true);
          setUser(null);
          setAccountDeletions(
            (previous) =>
              new Map(
                [...previous].map(([ownerId, entry]) => [
                  ownerId,
                  entry.busy ? entry : { ...entry, canSignIn: true },
                ]),
              ),
          );
        }
      });
    });
  }, [reload, setUser]);
  const sync = useCallback(async () => {
    if (!library) return;
    try {
      const before = await library.read();
      if (sessionSignal.aborted) return;
      // Show persisted pending answers immediately, even if the first network
      // attempt takes the full request timeout while the device is offline.
      setPending(before.queue.length);
      setSyncError(Object.values(before.errors)[0] ?? null);
      await library.sync();
      const state = await library.read();
      if (sessionSignal.aborted) return;
      setPending(state.queue.length);
      setSyncError(Object.values(state.errors)[0] ?? null);
    } catch (error) {
      if (sessionSignal.aborted) return;
      try {
        // A request may fail after its queued answer was explicitly discarded.
        // Only a fresh read can establish which answers still need attention.
        const state = await library.read();
        if (sessionSignal.aborted) return;
        setPending(state.queue.length);
        setSyncError(
          Object.values(state.errors)[0] ??
            (state.queue.length
              ? error instanceof Error
                ? error
                : new UserFacingError("connection")
              : null),
        );
      } catch (readError) {
        // Unknown device state keeps the previous count and shows the read failure.
        if (!sessionSignal.aborted)
          setSyncError(
            readError instanceof Error
              ? readError
              : new UserFacingError("localData"),
          );
      }
    } finally {
      if (!sessionSignal.aborted) {
        // A second quiz can gain a conflict without changing the total pending
        // count or the first error. Refresh each open quiz's persisted status.
        await queryClient.invalidateQueries({ queryKey: ["quiz-sync"] });
      }
    }
  }, [library, sessionSignal]);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const unavailable =
        state.isConnected === false || state.isInternetReachable === false;
      setOffline(unavailable);
      if (state.isConnected && !unavailable) void sync();
    });
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") void sync();
    });
    // Reconcile a persisted queue on account changes; all updates follow I/O.
    void sync();
    return () => {
      unsubscribe();
      listener.remove();
    };
  }, [sync]);
  useEffect(() => {
    // Recover interrupted media cleanup on launch/foreground, and collect
    // replaced or removed references after their local transaction commits.
    const collect = () => void collectOfflineImages().catch(() => undefined);
    collect();
    const unsubscribe = subscribeOfflineMediaChanges((store) => {
      if (store === storage) collect();
    });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") collect();
    });
    return () => {
      unsubscribe();
      listener.remove();
    };
  }, []);
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
    const originalSession = tokenStore.session();
    let ownedSession = originalSession;
    try {
      const ownerId =
        activeUserId.current ??
        (await storage.read<{ id?: string } | null>("last-user", null))?.id ??
        "";
      const tokens = await tokenStore.get();
      if (originalSession !== tokenStore.session()) return;
      // End local work before waiting for best-effort server revocation.
      const clearing = tokenStore.set(null);
      ownedSession = tokenStore.session();
      await clearing;
      await storage.removeLastUser(ownerId);
      // A newer login owns the visible state after asynchronous cache removal.
      if (ownedSession !== tokenStore.session()) return;
      queryClient.clear();
      setUser(null);
      setPending(0);
      setSyncError(null);
      setInitializationError(null);
      setReady(true);
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
        // Local sign-out is complete even when revocation cannot reach the API.
      }
    } catch (error) {
      if (ownedSession === tokenStore.session()) {
        setInitializationError(error);
        setReady(true);
      }
      throw error;
    }
  }
  const accountDeletion = userId
    ? (accountDeletions.get(userId) ?? null)
    : ([...accountDeletions.values()].find(
        (entry) => !dismissedDeletions.has(entry.ownerId),
      ) ?? null);
  return (
    <QueryClientProvider client={queryClient}>
      <Context.Provider
        value={{
          user,
          ready,
          initializationError,
          accountDeletion,
          leaveAccountDeletionRecovery,
          offline,
          pending,
          syncError,
          library,
          login,
          logout,
          finishAccountDeletion,
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
