import type { Quiz, SharedQuiz } from "@testownik/core/quiz/types";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { UserFacingError } from "./user-error";

/** Replace any older GET with the acknowledged write, then refresh in the background. */
export async function commitSharingAck<T>(
  cache: QueryClient,
  queryKey: QueryKey,
  session: AbortSignal,
  update: (previous: T | undefined) => T | undefined,
) {
  await cache.cancelQueries({ queryKey, exact: true }).catch(() => undefined);
  if (session.aborted) return;
  try {
    cache.setQueryData<T>(queryKey, update);
  } catch {
    /* A local cache problem cannot undo the server's acknowledged write. */
  }
  void cache
    .invalidateQueries({ queryKey, exact: true })
    .catch(() => undefined);
}

export function sharingEntry(value: unknown): value is SharedQuiz {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SharedQuiz>;
  return (
    typeof item.id === "string" &&
    !!item.id &&
    typeof item.allow_edit === "boolean" &&
    ((typeof item.user?.id === "string" &&
      typeof item.user.full_name === "string") ||
      (typeof item.group?.id === "string" &&
        typeof item.group.name === "string"))
  );
}

export function addSharingEntry(
  previous: SharedQuiz[] | undefined,
  value: unknown,
) {
  return sharingEntry(value)
    ? [...(previous ?? []).filter((item) => item.id !== value.id), value]
    : previous;
}

export function sharingQuizAck(previous: Quiz | undefined, value: unknown) {
  if (!previous || !value || typeof value !== "object") return previous;
  const ack = value as Partial<Quiz>;
  if (
    ack.id !== previous.id ||
    !Number.isInteger(ack.visibility) ||
    ack.visibility! < 0 ||
    ack.visibility! > 3 ||
    typeof ack.allow_anonymous !== "boolean" ||
    typeof ack.is_anonymous !== "boolean"
  )
    return previous;
  return {
    ...previous,
    visibility: ack.visibility!,
    allow_anonymous: ack.allow_anonymous,
    is_anonymous: ack.is_anonymous,
    ...(typeof ack.can_edit === "boolean" ? { can_edit: ack.can_edit } : {}),
    ...(typeof ack.title === "string" ? { title: ack.title } : {}),
    ...(Number.isSafeInteger(ack.version) ? { version: ack.version } : {}),
  } as Quiz;
}

export type SharingTarget = { user_id: string } | { study_group_id: string };
export const unconfirmedSharesKey = (id: string, userId: string) =>
  ["shares-unconfirmed", id, userId] as const;
export const sharingTargetKey = (target: SharingTarget) =>
  "user_id" in target
    ? `user:${target.user_id}`
    : `group:${target.study_group_id}`;

/** Only a completed server read can settle an ambiguous grant. Manual cache writes cannot. */
export function watchSharingReads(
  cache: QueryClient,
  id: string,
  userId: string,
  session: AbortSignal,
) {
  return cache.getQueryCache().subscribe((event) => {
    if (
      session.aborted ||
      event.type !== "updated" ||
      event.action.type !== "success" ||
      event.action.manual
    )
      return;
    const key = event.query.queryKey;
    if (
      key.length === 3 &&
      key[0] === "shares" &&
      key[1] === id &&
      key[2] === userId
    )
      cache.setQueryData<string[]>(unconfirmedSharesKey(id, userId), []);
  });
}

export function sharingRead(value: unknown): SharedQuiz[] {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === "object" && "results" in value
      ? value.results
      : undefined;
  if (!Array.isArray(entries) || !entries.every(sharingEntry))
    throw new UserFacingError("server");
  return entries;
}

export async function holdSharingTarget(
  cache: QueryClient,
  id: string,
  userId: string,
  session: AbortSignal,
  target: SharingTarget,
) {
  const queryKey = ["shares", id, userId];
  await cache.cancelQueries({ queryKey, exact: true }).catch(() => undefined);
  if (session.aborted) return;
  const key = sharingTargetKey(target);
  cache.setQueryData<string[]>(unconfirmedSharesKey(id, userId), (held = []) =>
    held.includes(key) ? held : [...held, key],
  );
  void cache
    .invalidateQueries({ queryKey, exact: true })
    .catch(() => undefined);
}

export function mayHaveSavedSharing(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? error.status
      : undefined;
  return (
    typeof status !== "number" ||
    status < 400 ||
    status >= 500 ||
    status === 408
  );
}

/** Keep a potentially committed grant from being repeated while its receipt is unreadable. */
export async function confirmSharingGrant(
  cache: QueryClient,
  id: string,
  userId: string,
  session: AbortSignal,
  target: SharingTarget,
  write: () => Promise<unknown>,
) {
  if (
    session.aborted ||
    cache
      .getQueryData<string[]>(unconfirmedSharesKey(id, userId))
      ?.includes(sharingTargetKey(target)) ||
    cache
      .getQueryData<SharedQuiz[]>(["shares", id, userId])
      ?.some((item) =>
        "user_id" in target
          ? item.user?.id === target.user_id
          : item.group?.id === target.study_group_id,
      )
  )
    return false;
  let ack: unknown;
  try {
    ack = await write();
  } catch (error) {
    if (session.aborted || !mayHaveSavedSharing(error)) throw error;
    await holdSharingTarget(cache, id, userId, session, target);
    throw new UserFacingError("sharingUnconfirmed");
  }
  const matches =
    sharingEntry(ack) &&
    ("user_id" in target
      ? ack.user?.id === target.user_id
      : ack.group?.id === target.study_group_id);
  if (!matches) {
    await holdSharingTarget(cache, id, userId, session, target);
    return false;
  }
  await commitSharingAck<SharedQuiz[]>(
    cache,
    ["shares", id, userId],
    session,
    (previous) => addSharingEntry(previous, ack),
  );
  return true;
}
