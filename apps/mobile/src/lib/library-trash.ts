import type { LibraryItem } from "@testownik/core/quiz/library";
import { ApiError } from "./client";

export function trashItems(items: readonly LibraryItem[] = []) {
  return items.filter(
    (item) =>
      item.type === "quiz" &&
      item.can_manage === true &&
      !item.shortcut_id &&
      typeof item.deleted_at === "string" &&
      Number.isFinite(Date.parse(item.deleted_at)),
  );
}

/** A confirmation covers only the entries shown when it opened. */
export function createTrashDeletion(
  approvedItems: readonly LibraryItem[],
  currentItems: () => readonly LibraryItem[] | undefined,
  remove: (id: string) => Promise<unknown>,
) {
  const approved = new Set(trashItems(approvedItems).map((item) => item.id));
  return async () => {
    for (const item of trashItems(currentItems())) {
      if (!approved.has(item.id)) continue;
      try {
        await remove(item.id);
      } catch (error) {
        // An earlier timed-out deletion may already have committed.
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
  };
}
