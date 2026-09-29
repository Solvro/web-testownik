/** Move by identity so delayed native events cannot reorder the wrong question. */
export function moveQuestion<T extends { id: string }>(
  rows: T[],
  id: string,
  beforeId: string | null,
): T[] {
  const item = rows.find((row) => row.id === id);
  if (
    !item ||
    id === beforeId ||
    (beforeId !== null && !rows.some((row) => row.id === beforeId))
  )
    return rows;
  const remaining = rows.filter((row) => row.id !== id);
  remaining.splice(
    beforeId === null
      ? remaining.length
      : remaining.findIndex((row) => row.id === beforeId),
    0,
    item,
  );
  return remaining;
}
