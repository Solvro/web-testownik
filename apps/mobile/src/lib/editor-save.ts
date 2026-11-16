const saves = new Map<string, Promise<void>>();

/** A reopened editor must not restore a draft whose save is still settling. */
export function waitForEditorSave(key: string) {
  return saves.get(key)?.catch(() => undefined) ?? Promise.resolve();
}

export function runEditorSave(key: string, save: () => Promise<void>) {
  const pending = Promise.resolve().then(save);
  saves.set(key, pending);
  const clear = () => {
    if (saves.get(key) === pending) saves.delete(key);
  };
  void pending.then(clear, clear);
  return pending;
}
