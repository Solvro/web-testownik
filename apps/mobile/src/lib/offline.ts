import type {
  AnswerRecord,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";

import type { ApiClient } from "./client";
import { ApiError } from "./client";
import { UserFacingError } from "./user-error";

export interface PendingAnswer {
  request_id: string;
  quiz_id: string;
  session_id: string;
  version: number;
  question_id: string;
  selected_answers: string[];
  elapsed_seconds: number;
  next_question: string | null;
  local: AnswerRecord;
}
export interface OfflineState {
  quizzes: Record<string, QuizWithUserProgress>;
  queue: PendingAnswer[];
  errors: Record<string, string>;
}
export interface OfflineStorage {
  read<T>(key: string, fallback: T): Promise<T>;
  write<T>(key: string, value: T): Promise<void>;
}
export const emptyState = (): OfflineState => ({
  quizzes: {},
  queue: [],
  errors: {},
});
export class OfflineLibrary {
  private serial: Promise<unknown> = Promise.resolve();
  private syncing: Promise<void> | null = null;
  constructor(
    private userId: string,
    private store: OfflineStorage,
    private api: ApiClient,
  ) {}
  read() {
    return this.store.read<OfflineState>(
      `offline.${this.userId}`,
      emptyState(),
    );
  }
  private mutate(fn: (state: OfflineState) => void) {
    const run = this.serial.then(async () => {
      const state = await this.read();
      fn(state);
      await this.store.write(`offline.${this.userId}`, state);
    });
    this.serial = run.catch(() => {});
    return run;
  }
  async cache(quiz: QuizWithUserProgress) {
    await this.mutate((state) => {
      if (!state.queue.some((x) => x.quiz_id === quiz.id))
        state.quizzes[quiz.id] = quiz;
    });
  }
  async enqueue(item: PendingAnswer, quiz: QuizWithUserProgress) {
    await this.mutate((state) => {
      if (!state.queue.some((x) => x.request_id === item.request_id))
        state.queue.push(item);
      state.quizzes[quiz.id] = quiz;
    });
  }
  async remove(quizId: string) {
    await this.mutate((state) => {
      if (state.queue.some((x) => x.quiz_id === quizId))
        throw new UserFacingError("pendingAnswers");
      delete state.quizzes[quizId];
    });
  }
  async discard(quizId: string) {
    await this.mutate((state) => {
      state.queue = state.queue.filter((x) => x.quiz_id !== quizId);
      delete state.quizzes[quizId];
      delete state.errors[quizId];
    });
  }
  async sync() {
    if (this.syncing) return this.syncing;
    this.syncing = this.flush().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }
  private async flush() {
    const blocked = new Set<string>();
    for (const item of (await this.read()).queue) {
      if (blocked.has(item.quiz_id)) continue;
      try {
        const { quiz_id, local, ...payload } = item;
        const record = await this.api.post<AnswerRecord>(
          `mobile/quizzes/${quiz_id}/answer/`,
          payload,
        );
        await this.mutate((state) => {
          state.queue = state.queue.filter(
            (x) => x.request_id !== item.request_id,
          );
          delete state.errors[quiz_id];
          const session = state.quizzes[quiz_id]?.current_session;
          if (session)
            session.answers = session.answers.map((a) =>
              a.id === local.id ? record : a,
            );
        });
      } catch (error) {
        if (
          error instanceof ApiError &&
          [400, 403, 404, 409].includes(error.status)
        ) {
          blocked.add(item.quiz_id);
          await this.mutate((state) => {
            state.errors[item.quiz_id] = error.message;
          });
        } else throw error;
      }
    }
  }
}
