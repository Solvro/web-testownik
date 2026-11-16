import type { TokenStore } from "./client";

/** A cached browser profile belongs to one tab's authenticated session. */
export function withProfileOwnership(
  store: TokenStore,
  clearProfile: () => void,
): TokenStore {
  return {
    ...store,
    async set(tokens, expectedSession) {
      // A delayed request from A must not clear the profile of a newer B login.
      if (expectedSession && expectedSession !== store.session())
        return store.set(tokens, expectedSession);
      if (!tokens) {
        const clearing = store.set(null, expectedSession);
        const endingSession = store.session();
        await clearing;
        // Failed credential removal needs its profile to identify the deleted
        // owner on retry. A newer login owns any profile cached in the meantime.
        if (store.session() === endingSession) clearProfile();
        return;
      }
      // Refresh keeps the account identity; a new login ends that identity.
      if (!expectedSession) clearProfile();
      return store.set(tokens, expectedSession);
    },
  };
}
