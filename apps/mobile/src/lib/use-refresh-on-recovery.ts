import { useEffect, useRef } from "react";

/** Refresh once after connectivity or saved answers recover, when the screen is safe. */
export function useRefreshOnRecovery({
  scope,
  offline,
  pending = 0,
  local = false,
  enabled,
  refresh,
}: {
  scope: string;
  offline: boolean;
  pending?: number;
  local?: boolean;
  enabled: boolean;
  refresh: () => Promise<unknown>;
}) {
  const previous = useRef({ scope, offline, pending });
  const needed = useRef(false);
  useEffect(() => {
    const before = previous.current;
    if (before.scope !== scope) needed.current = false;
    else if (
      (before.offline && !offline) ||
      (local && before.pending > pending)
    )
      needed.current = true;
    previous.current = { scope, offline, pending };
    if (!needed.current || offline || !enabled) return;
    // Consume before starting I/O: a failed refresh gets its normal saved-copy
    // notice/retry, rather than triggering an effect retry loop.
    needed.current = false;
    void refresh().catch(() => undefined);
  }, [scope, offline, pending, local, enabled, refresh]);
}
