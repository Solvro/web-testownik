import { expect, it } from "vitest";
import { purgeAccountData } from "../src/lib/account-data";

it("purges only the deleted owner's account keys, preserving preferences and nearby identities", async () => {
  const values = new Map<string, string>();
  const owned = [
    "offline.owner",
    "draft.owner.new",
    "quiz-create.owner.new",
    "chat.owner.quiz",
    "chat-draft.owner.quiz.question",
    "quiz-ai-model.owner.quiz",
  ];
  const retained = [
    "offline.owner-other",
    "draft.owner-other.new",
    "quiz-create.owner-other.new",
    "chat.owner-other.quiz",
    "language",
    "library-sort",
    "last-user",
  ];
  for (const key of [...owned, ...retained]) values.set(key, "private data");
  const store = {
    keys: async () => [...values.keys()],
    read: async <T>(_key: string, fallback: T) => fallback,
    write: async () => {},
    readStrict: async () => {
      throw new Error("Damaged JSON");
    },
    remove: async (key: string) => {
      values.delete(key);
    },
  };
  await expect(purgeAccountData(store, "owner")).resolves.toEqual([]);
  expect([...values.keys()]).toEqual(retained);
});
