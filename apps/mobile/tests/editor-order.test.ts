import { expect, it } from "vitest";
import { moveQuestion } from "../src/lib/editor-order";
it("moves questions by identity in both directions without losing attached content", () => {
  const rows = [{ id: "a", image: "photo" }, { id: "b" }, { id: "c" }];
  expect(moveQuestion(rows, "a", null).map((q) => q.id)).toEqual([
    "b",
    "c",
    "a",
  ]);
  expect(moveQuestion(rows, "c", "a").map((q) => q.id)).toEqual([
    "c",
    "a",
    "b",
  ]);
  expect(moveQuestion(rows, "a", null)[2]).toBe(rows[0]);
  expect(rows.map((q) => q.id)).toEqual(["a", "b", "c"]);
});
it("ignores stale and self-targeted move events", () => {
  const rows = [{ id: "a" }, { id: "b" }];
  expect(moveQuestion(rows, "gone", "a")).toBe(rows);
  expect(moveQuestion(rows, "a", "gone")).toBe(rows);
  expect(moveQuestion(rows, "a", "a")).toBe(rows);
});
