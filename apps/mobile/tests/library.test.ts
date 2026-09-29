import { describe, expect, it } from "vitest";
import {
  canMoveTo,
  sortLibrary,
  type LibraryData,
  type LibraryItem,
} from "@testownik/core/quiz/library";
const quiz = (id: string, name: string, date?: string): LibraryItem => ({
  id,
  name,
  type: "quiz",
  can_edit: true,
  created_at: date,
});
describe("library organization", () => {
  it("keeps folders first, compares names naturally, and leaves cached data untouched", () => {
    const items = [
      quiz("ten", "Quiz 10"),
      { ...quiz("f", "Folder"), type: "folder" as const },
      quiz("two", "Quiz 2"),
    ];
    expect(sortLibrary(items, "az", "en").map((item) => item.id)).toEqual([
      "f",
      "two",
      "ten",
    ]);
    expect(items[0].id).toBe("ten");
    expect(sortLibrary(items, "za", "en").map((item) => item.id)).toEqual([
      "f",
      "ten",
      "two",
    ]);
  });
  it("sorts recent activity and creation separately, with deterministic undated entries", () => {
    const items = [
      { ...quiz("a", "A", "2025-01-01"), last_used_at: "2026-01-01" },
      quiz("b", "B", "2025-02-01"),
      quiz("c", "C", "invalid"),
    ];
    expect(sortLibrary(items, "recent", "en").map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortLibrary(items, "newest", "en").map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
  it("prevents same-parent, protected, self and descendant folder destinations", () => {
    const data: LibraryData = {
      items: [],
      can_create_folder: true,
      path: [
        { id: "root", name: "Root" },
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    };
    expect(canMoveTo(data, { id: "a", type: "folder" })).toBe(false);
    expect(canMoveTo(data, { id: "quiz", type: "quiz", parent: "b" })).toBe(
      false,
    );
    expect(
      canMoveTo(
        { ...data, can_create_folder: false },
        { id: "quiz", type: "quiz" },
      ),
    ).toBe(false);
    expect(canMoveTo(data, { id: "quiz", type: "quiz", parent: "root" })).toBe(
      true,
    );
  });
});
