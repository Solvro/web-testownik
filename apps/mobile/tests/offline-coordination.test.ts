import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { expect, it, vi } from "vitest";
import type { ApiClient } from "../src/lib/client";
import {
  OfflineLibrary,
  offlineTransaction,
  type PendingAnswer,
} from "../src/lib/offline";

function answer(quizId: string) {
  const local = {
    id: `local-${quizId}`,
    question: `q-${quizId}`,
    selected_answers: [`a-${quizId}`],
    was_correct: true,
    answered_at: "2026-10-12T02:00:00Z",
  };
  const quiz = {
    id: quizId,
    title: quizId,
    questions: [],
    current_session: { id: `session-${quizId}`, answers: [local] },
  } as unknown as QuizWithUserProgress;
  const pending: PendingAnswer = {
    request_id: local.id,
    quiz_id: quizId,
    session_id: `session-${quizId}`,
    version: 1,
    question_id: local.question,
    selected_answers: local.selected_answers,
    elapsed_seconds: 1,
    next_question: null,
    local,
  };
  return { quiz, pending };
}

it("coordinates a whole read-modify-write across separate facades sharing one browser backend", async () => {
  let raw = JSON.stringify({ quizzes: {}, queue: [], errors: {} }),
    lock = Promise.resolve() as Promise<unknown>,
    writes = 0,
    reads = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const facade = () => ({
    read: async <T>(_key: string, _fallback: T): Promise<T> => {
      reads++;
      return JSON.parse(raw);
    },
    write: async (_key: string, value: unknown) => {
      writes++;
      await gate;
      raw = JSON.stringify(value);
    },
    withOfflineTransaction<T>(run: () => Promise<T>) {
      const next = lock.then(run);
      lock = next.catch(() => undefined);
      return next;
    },
  });
  const a = new OfflineLibrary("owner", facade(), {} as ApiClient),
    b = new OfflineLibrary("owner", facade(), {} as ApiClient),
    first = answer("bank-A"),
    second = answer("bank-B");
  const operations = [
    a.enqueue(first.pending, first.quiz),
    b.enqueue(second.pending, second.quiz),
  ];
  await vi.waitFor(() => expect(writes).toBeGreaterThan(0));
  expect(reads).toBe(1);
  expect(writes).toBe(1);
  release();
  await Promise.all(operations);
  expect(
    JSON.parse(raw)
      .queue.map((item: PendingAnswer) => item.quiz_id)
      .sort(),
  ).toEqual(["bank-A", "bank-B"]);
});

it("does not read or overwrite retained bytes when cross-context coordination fails", async () => {
  const read = vi.fn(),
    write = vi.fn();
  const library = new OfflineLibrary(
    "owner",
    {
      read,
      write,
      withOfflineTransaction: async () => {
        throw new Error("Coordination denied");
      },
    },
    {} as ApiClient,
  );
  const item = answer("bank-A");
  await expect(library.enqueue(item.pending, item.quiz)).rejects.toThrow(
    "Coordination denied",
  );
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

it("releases both coordination queues after a failed leaf write", async () => {
  const failure = new Error("Quota denied");
  let tail = Promise.resolve() as Promise<unknown>;
  const store = {
    read: vi.fn(),
    write: vi.fn(),
    withOfflineTransaction<T>(run: () => Promise<T>) {
      expect(this).toBe(store);
      const next = tail.then(run);
      tail = next.catch(() => undefined);
      return next;
    },
  };
  const first = offlineTransaction(store, async () => {
    throw failure;
  });
  const second = offlineTransaction(store, async () => "next transaction");
  await expect(first).rejects.toBe(failure);
  await expect(second).resolves.toBe("next transaction");
});

it("recovers the local queue after an outer acquisition failure without running its callback", async () => {
  const run = vi.fn(async () => "saved"),
    enter = vi
      .fn()
      .mockRejectedValueOnce(new Error("Acquisition timed out"))
      .mockImplementation(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
    store = { read: vi.fn(), write: vi.fn(), withOfflineTransaction: enter };
  await expect(offlineTransaction(store, run)).rejects.toThrow(
    "Acquisition timed out",
  );
  expect(run).not.toHaveBeenCalled();
  await expect(offlineTransaction(store, run)).resolves.toBe("saved");
  expect(run).toHaveBeenCalledOnce();
});
