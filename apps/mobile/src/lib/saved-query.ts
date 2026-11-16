// Ephemeral query metadata is deliberately omitted by JSON persistence.
const localCopy = Symbol("saved-query-local-snapshot");
export function markLocalQuery<T extends object>(value: T) {
  return { ...value, [localCopy]: true as const };
}
export function isLocalQuery(value: object | undefined): boolean {
  return !!(value as { [localCopy]?: true } | undefined)?.[localCopy];
}
const savedCopy = Symbol("saved-query-updates-unavailable");
export function markSavedQuery<T extends object>(value: T) {
  return { ...markLocalQuery(value), [savedCopy]: true as const };
}
export function isSavedQuery(value: object | undefined): boolean {
  return !!(value as { [savedCopy]?: true } | undefined)?.[savedCopy];
}
