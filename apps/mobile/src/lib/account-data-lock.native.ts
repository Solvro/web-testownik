export async function withAccountDataLock<T>(
  run: () => Promise<T>,
): Promise<T> {
  return run();
}

export async function withOfflineDataLock<T>(
  run: () => Promise<T>,
): Promise<T> {
  return run();
}

export async function withQuizCreateLock<T>(
  _owner: string,
  run: () => Promise<T>,
): Promise<T> {
  return run();
}
