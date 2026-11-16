import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import {
  AccessLevel,
  type QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import type { ApiClient } from "../src/lib/client";
import { OfflineLibrary, type OfflineStorage } from "../src/lib/offline";
import { createAndroidChunkStorage } from "../src/lib/android-chunk-storage";

it("an aggregate saved-quiz limit preserves other quizzes, queued answers and conflicts until explicit management", async () => {
  const values = new Map<string, string>();
  const adapter = createAndroidChunkStorage(
    {
      getItem: async (key) => values.get(key) ?? null,
      getAllKeys: async () => [...values.keys()],
      multiGet: async (keys) =>
        keys.map((key) => [key, values.get(key) ?? null] as const),
      multiSet: async (pairs) => {
        for (const [key, value] of pairs) values.set(key, value);
      },
      multiRemove: async (keys) => {
        for (const key of keys) values.delete(key);
      },
    },
    async (value) => createHash("sha256").update(value).digest("hex"),
  );
  const store: OfflineStorage = {
    read: async <T>(key: string, fallback: T) => {
      const value = await adapter.getItem(`testownik.v1.${key}`);
      return value === null ? fallback : (JSON.parse(value) as T);
    },
    write: (key, value) =>
      adapter.setItem(`testownik.v1.${key}`, JSON.stringify(value)),
  };
  const library = new OfflineLibrary("owner", store, {} as ApiClient);
  const bank = (id: string): QuizWithUserProgress => ({
    id,
    title: id,
    description: "",
    visibility: AccessLevel.PRIVATE,
    allow_anonymous: false,
    is_anonymous: false,
    version: 1,
    questions: [
      {
        id: "q",
        order: 0,
        text: "x".repeat(3 * 1024 * 1024),
        multiple: false,
        answers: [{ id: "a", order: 0, text: "Answer", is_correct: true }],
      },
    ],
    current_session: {
      id: "session",
      started_at: "2026-10-11T20:00:00Z",
      ended_at: null,
      is_active: true,
      current_question: "q",
      study_time: 0,
      answers: [],
    },
  });
  const retained = bank("retained"),
    removable = bank("removable"),
    incoming = bank("incoming");
  await library.cache(retained);
  await library.cache(removable);
  const answer = {
    id: "local",
    question: "q",
    selected_answers: ["a"],
    was_correct: true,
    answered_at: "2026-10-11T20:00:00Z",
  };
  await library.enqueue(
    {
      request_id: answer.id,
      quiz_id: retained.id,
      session_id: "session",
      version: 1,
      question_id: "q",
      selected_answers: ["a"],
      elapsed_seconds: 0,
      next_question: null,
      local: answer,
    },
    {
      ...retained,
      current_session: {
        ...retained.current_session!,
        answers: [answer],
        current_question: null,
      },
    },
  );
  const withConflict = await library.read();
  withConflict.errors.retained = "Explicit recovery required";
  await store.write("offline.owner", withConflict);
  const before = [...values];
  await expect(library.cache(incoming)).rejects.toMatchObject({
    code: "storageValueTooLarge",
    issue: { fitsAlone: true },
  });
  expect([...values]).toEqual(before);
  expect(await library.read()).toEqual(withConflict);
  await expect(library.remove(retained.id)).rejects.toMatchObject({
    code: "pendingAnswers",
  });
  // The user can explicitly remove a different saved quiz and retry the download.
  await library.remove(removable.id);
  await library.cache(incoming);
  const recovered = await library.read();
  expect(Object.keys(recovered.quizzes)).toEqual([retained.id, incoming.id]);
  expect(recovered.queue).toEqual(withConflict.queue);
  expect(recovered.errors).toEqual(withConflict.errors);
  expect(recovered.quizzes.retained.current_session?.answers).toEqual([answer]);
});
