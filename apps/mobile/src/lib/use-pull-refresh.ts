import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh that keeps the indicator up until the refresh settles, so
 * the gesture has visible feedback instead of snapping back immediately.
 */
export function usePullRefresh(refresh: () => Promise<unknown> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return {
    refreshing,
    onRefresh: () => {
      setRefreshing(true);
      void Promise.resolve()
        .then(refresh)
        .catch(() => undefined)
        .finally(() => {
          if (mounted.current) setRefreshing(false);
        });
    },
  };
}
