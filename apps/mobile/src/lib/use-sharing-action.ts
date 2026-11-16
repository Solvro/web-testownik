import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { notify } from "./alerts";
import { api } from "./api";
import { useLocale } from "./locale";
import { tokenStore } from "./storage";
import { unconfirmedSharesKey, watchSharingReads } from "./sharing-ack";
import { UserFacingError, userError } from "./user-error";

export function useSharingAction(
  id: string,
  userId: string,
  notifyErrors = false,
) {
  const [session] = useState(() => tokenStore.session());
  const [client] = useState(() => api.forSession(session));
  const cache = useQueryClient();
  const { t } = useLocale();
  const mounted = useRef(true);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => watchSharingReads(cache, id, userId, session),
    [cache, id, userId, session],
  );
  const held = useQuery<string[]>({
    queryKey: unconfirmedSharesKey(id, userId),
    queryFn: async () => [],
    enabled: false,
    initialData: [],
    gcTime: Infinity,
  });
  const mutationKey = ["sharing-mutation", id, userId];
  const busy = useIsMutating({ mutationKey }) > 0;
  const mutation = useMutation({
    mutationKey,
    networkMode: "always",
    mutationFn: (action: () => Promise<unknown>) => action(),
    onError: (error: unknown) => {
      if (session.aborted) return;
      void cache
        .invalidateQueries({ queryKey: ["shares", id, userId], exact: true })
        .catch(() => undefined);
      void cache
        .invalidateQueries({
          queryKey: ["sharing-quiz", id, userId],
          exact: true,
        })
        .catch(() => undefined);
      if (mounted.current && !notifyErrors) setFailure(error);
      else
        notify(
          error instanceof UserFacingError &&
            error.code === "sharingUnconfirmed"
            ? t("Nie potwierdzono dostępu", "Access Not Confirmed")
            : notifyErrors
              ? t("Nie dodano", "Couldn’t Add")
              : t("Nie zapisano zmiany", "Change Not Saved"),
          userError(error, t),
        );
    },
  });
  async function mutate(action: () => Promise<unknown>) {
    if (session.aborted || cache.isMutating({ mutationKey })) return;
    setFailure(null);
    await mutation.mutateAsync(action).catch(() => undefined);
  }
  return {
    client,
    session,
    busy,
    failure,
    mutate,
    mounted,
    heldTargets: held.data ?? [],
  };
}
