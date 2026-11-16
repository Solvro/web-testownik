import { expect, it, vi } from "vitest";
import type { LibraryItem } from "@testownik/core/quiz/library";
import { ApiError } from "../src/lib/client";
import { createTrashDeletion, trashItems } from "../src/lib/library-trash";

const item = (
  id: string,
  overrides: Partial<LibraryItem> = {},
): LibraryItem => ({
  id,
  name: id,
  type: "quiz",
  can_edit: true,
  can_manage: true,
  deleted_at: "2026-10-11T12:00:00Z",
  ...overrides,
});

it.each([
  { deleted_at: null },
  { can_manage: false },
  { shortcut_id: "shortcut" },
])(
  "a held confirmation skips changed original entries and never adds a new quiz: %j",
  async (change) => {
    let current = [item("a"), item("b")];
    const remove = vi.fn(async (_id: string) => {});
    const confirm = createTrashDeletion(current, () => current, remove);
    current = [item("a", change), item("b"), item("newly-trashed")];
    await confirm();
    expect(remove.mock.calls).toEqual([["b"]]);
  },
);

it("an unavailable latest cache fails closed after confirmation", async () => {
  const remove = vi.fn(async (_id: string) => {});
  const confirm = createTrashDeletion([item("a")], () => undefined, remove);
  await confirm();
  expect(remove).not.toHaveBeenCalled();
});

it("rejects missing or malformed deletion and management metadata", () => {
  const malformed = [
    item("missing-date", { deleted_at: undefined }),
    item("invalid-date", { deleted_at: "not-a-date" }),
    item("empty-date", { deleted_at: "" }),
    item("missing-owner", { can_manage: undefined }),
    { ...item("invalid-owner"), can_manage: "true" },
    { ...item("invalid-date-type"), deleted_at: 123 },
  ];
  expect(trashItems(malformed as LibraryItem[])).toEqual([]);
  expect(trashItems([item("valid")]).map((entry) => entry.id)).toEqual([
    "valid",
  ]);
});

it("an explicit retry skips an already committed404 and continues the approved list", async () => {
  const items = [item("gone"), item("remaining")];
  const remove = vi.fn(async (id: string) => {
    if (id === "gone") throw new ApiError(404, "Gone");
  });
  await createTrashDeletion(items, () => items, remove)();
  expect(remove.mock.calls).toEqual([["gone"], ["remaining"]]);
});

it("stops on an ambiguous failure without deleting later entries automatically", async () => {
  const items = [item("first"), item("later")];
  const remove = vi.fn(async (_id: string) => {
    throw new ApiError(503, "Unavailable");
  });
  await expect(
    createTrashDeletion(items, () => items, remove)(),
  ).rejects.toMatchObject({ status: 503 });
  expect(remove.mock.calls).toEqual([["first"]]);
});
