import type { UserSettings } from "@testownik/core/user/types";

type Listener = (patch: Partial<UserSettings>) => void;
const listeners = new Set<Listener>();

/**
 * Pages pushed from Study Settings (like the model list) hand their changes
 * back here, so the settings screen keeps owning the one debounced save.
 */
export function applySettings(patch: Partial<UserSettings>) {
  for (const listener of listeners) listener(patch);
}

export function onApplySettings(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
