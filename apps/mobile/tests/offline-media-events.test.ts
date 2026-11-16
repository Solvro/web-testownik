import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { expect, it } from "vitest";
import type { ApiClient } from "../src/lib/client";
import { purgeAccountData } from "../src/lib/account-data";
import {
  OfflineLibrary,
  subscribeOfflineMediaChanges,
  type OfflineStorage,
  type PendingAnswer,
} from "../src/lib/offline";
const q: QuizWithUserProgress = {
  id: "quiz",
  title: "Quiz",
  version: 1,
  description: "",
  visibility: 0,
  allow_anonymous: false,
  is_anonymous: false,
  questions: [
    {
      id: "question",
      text: "Question",
      order: 1,
      multiple: false,
      image: "https://fixture.invalid/old.png",
      answers: [],
    },
  ],
};
function fixture() {
  const bytes = new Map<string, string>();
  let fail = false;
  const store = {
    read: async <T>(key: string, fallback: T): Promise<T> =>
      bytes.has(key) ? JSON.parse(bytes.get(key)!) : fallback,
    write: async <T>(key: string, value: T) => {
      if (fail) throw new Error("write failed");
      bytes.set(key, JSON.stringify(value));
    },
    keys: async () => [...bytes.keys()],
    remove: async (key: string) => {
      bytes.delete(key);
    },
  };
  const events: OfflineStorage[] = [];
  const unsubscribe = subscribeOfflineMediaChanges((changed) => {
    events.push(changed);
  });
  return {
    bytes,
    store,
    events,
    unsubscribe,
    fail: () => {
      fail = true;
    },
    library: new OfflineLibrary("A", store, {} as ApiClient),
  };
}
it("emits after replacement/removal commits and keeps callback store scope", async () => {
  const f = fixture();
  try {
    await f.library.cache(q);
    expect(f.events).toHaveLength(0);
    await f.library.cache({
      ...q,
      version: 2,
      questions: [
        { ...q.questions[0], image: "https://fixture.invalid/new.png" },
      ],
    });
    expect(f.events).toEqual([f.store]);
    await f.library.remove(q.id);
    expect(f.events).toEqual([f.store, f.store]);
  } finally {
    f.unsubscribe();
  }
});
it("does not start cleanup for each answer or a rejected removal", async () => {
  const f = fixture();
  try {
    const active = {
      ...q,
      current_session: {
        id: "session",
        started_at: "2026-10-12T00:00:00Z",
        ended_at: null,
        is_active: true,
        study_time: 0,
        current_question: "question",
        answers: [],
      },
    };
    await f.library.cache(active);
    const pending: PendingAnswer = {
      request_id: "answer",
      quiz_id: q.id,
      session_id: "session",
      version: 1,
      question_id: "question",
      selected_answers: [],
      elapsed_seconds: 1,
      next_question: null,
      local: {
        id: "answer",
        question: "question",
        answered_at: "2026-10-12T00:00:00Z",
        selected_answers: [],
        was_correct: false,
      },
    };
    await f.library.enqueue(pending, {
      ...active,
      current_session: { ...active.current_session, answers: [pending.local] },
    });
    expect(f.events).toHaveLength(0);
    await expect(f.library.remove(q.id)).rejects.toBeDefined();
    expect(f.events).toHaveLength(0);
    await f.library.discard(q.id);
    expect(f.events).toEqual([f.store]);
  } finally {
    f.unsubscribe();
  }
});
it("does not emit after a failed cache write", async () => {
  const f = fixture();
  try {
    await f.library.cache(q);
    const before = f.bytes.get("offline.A");
    f.fail();
    await expect(f.library.cache({ ...q, version: 2 })).rejects.toBeDefined();
    expect(f.events).toHaveLength(0);
    expect(f.bytes.get("offline.A")).toBe(before);
  } finally {
    f.unsubscribe();
  }
});
it("emits after account purge and preserves another owner's exact bytes", async () => {
  const f = fixture();
  try {
    await f.library.cache(q);
    const retained = f.bytes.get("offline.A")!;
    f.bytes.set("offline.B", retained);
    await purgeAccountData(f.store, "A");
    expect(f.events).toEqual([f.store]);
    expect(f.bytes.has("offline.A")).toBe(false);
    expect(f.bytes.get("offline.B")).toBe(retained);
  } finally {
    f.unsubscribe();
  }
});

it("does not scan media after equal GET clones or progress-only cache refreshes", async () => {
  const f = fixture();
  try {
    await f.library.cache(q);
    await f.library.cache(JSON.parse(JSON.stringify(q)));
    await f.library.cache({
      ...q,
      title: "Updated title",
      version: 2,
      current_session: {
        id: "session",
        started_at: "2026-10-12T00:00:00Z",
        ended_at: null,
        is_active: true,
        current_question: null,
        answers: [],
        study_time: 12,
      },
    });
    expect(f.events).toHaveLength(0);
    expect(JSON.parse(f.bytes.get("offline.A")!).quizzes[q.id].title).toBe(
      "Updated title",
    );
  } finally {
    f.unsubscribe();
  }
});

it.each([
  "question text",
  "question explanation",
  "question image",
  "answer text",
  "answer image",
  "removed question",
])("notifies after committed media input changes: %s", async (field) => {
  const f = fixture();
  try {
    const previous: QuizWithUserProgress = {
      ...q,
      questions: [
        {
          ...q.questions[0],
          answers: [
            {
              id: "answer",
              order: 1,
              text: "Answer",
              is_correct: true,
              image: "https://fixture.invalid/answer.png",
            },
          ],
        },
      ],
    };
    await f.library.cache(previous);
    const next: QuizWithUserProgress = JSON.parse(JSON.stringify(previous));
    if (field === "question text")
      next.questions[0].text = "![New](https://fixture.invalid/new.png)";
    if (field === "question explanation")
      next.questions[0].explanation = "![New](https://fixture.invalid/new.png)";
    if (field === "question image") next.questions[0].image = null;
    if (field === "answer text")
      next.questions[0].answers[0].text =
        "![New](https://fixture.invalid/new.png)";
    if (field === "answer image") next.questions[0].answers[0].image = null;
    if (field === "removed question") next.questions = [];
    await f.library.cache(next);
    expect(f.events).toEqual([f.store]);
    expect(JSON.parse(f.bytes.get("offline.A")!).quizzes[q.id]).toEqual(next);
  } finally {
    f.unsubscribe();
  }
});
