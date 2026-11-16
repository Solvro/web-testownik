import type {
  AnswerRecord,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";

import type { ApiClient } from "./client";
import { ApiError } from "./client";
import { UserFacingError } from "./user-error";
import { explainQuizStorageFailure } from "./quiz-storage-issue";

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
  /** Kept after removal so an older request cannot restore a discarded quiz. */
  generations?: Record<string, number>;
}
export interface OfflineSnapshot {
  localRevision: number;
  generation: number;
}
export interface OfflineStorage {
  withOfflineTransaction?<T>(run: () => Promise<T>): Promise<T>;
  read<T>(key: string, fallback: T): Promise<T>;
  readStrict?<T>(key: string, fallback: T): Promise<T>;
  write<T>(key: string, value: T): Promise<void>;
}
export const emptyState = (): OfflineState => ({
  quizzes: {},
  queue: [],
  errors: {},
});
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function isAnswerList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText);
}
function validAnswerRecord(value: unknown): value is AnswerRecord {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.question) &&
    isText(value.answered_at) &&
    isAnswerList(value.selected_answers) &&
    typeof value.was_correct === "boolean"
  );
}
function optionalText(value: unknown) {
  return value == null || typeof value === "string";
}
// Check the fields consumed by study/history, without requiring newer metadata
// on older saved banks. Invalid data stays in storage for explicit recovery.
function validSavedQuiz(value: unknown): value is QuizWithUserProgress {
  if (
    !isRecord(value) ||
    !isText(value.id) ||
    typeof value.title !== "string" ||
    !Array.isArray(value.questions) ||
    !value.questions.every(
      (question: unknown) =>
        isRecord(question) &&
        isText(question.id) &&
        typeof question.text === "string" &&
        (question.multiple === undefined ||
          typeof question.multiple === "boolean") &&
        optionalText(question.image) &&
        optionalText(question.explanation) &&
        Array.isArray(question.answers) &&
        question.answers.every(
          (answer: unknown) =>
            isRecord(answer) &&
            isText(answer.id) &&
            typeof answer.text === "string" &&
            typeof answer.is_correct === "boolean" &&
            optionalText(answer.image),
        ),
    )
  )
    return false;
  const session = value.current_session;
  return (
    session == null ||
    (isRecord(session) &&
      isText(session.id) &&
      Array.isArray(session.answers) &&
      session.answers.every(validAnswerRecord) &&
      (session.current_question == null || isText(session.current_question)) &&
      (session.study_time == null ||
        (typeof session.study_time === "number" &&
          Number.isFinite(session.study_time) &&
          session.study_time >= 0)))
  );
}
function validPendingAnswer(value: unknown): value is PendingAnswer {
  if (!isRecord(value) || !isRecord(value.local)) return false;
  const local = value.local;
  return (
    [
      value.request_id,
      value.quiz_id,
      value.session_id,
      value.question_id,
    ].every(isText) &&
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version >= 0 &&
    typeof value.elapsed_seconds === "number" &&
    Number.isInteger(value.elapsed_seconds) &&
    value.elapsed_seconds >= 0 &&
    value.elapsed_seconds <= 3600 &&
    isAnswerList(value.selected_answers) &&
    (value.next_question === null || isText(value.next_question)) &&
    isText(local.id) &&
    isText(local.question) &&
    isText(local.answered_at) &&
    isAnswerList(local.selected_answers) &&
    typeof local.was_correct === "boolean"
  );
}
export function validState(state: unknown): state is OfflineState {
  return (
    isRecord(state) &&
    isRecord(state.quizzes) &&
    Object.values(state.quizzes).every(validSavedQuiz) &&
    Array.isArray(state.queue) &&
    state.queue.every(validPendingAnswer) &&
    isRecord(state.errors) &&
    Object.values(state.errors).every((value) => typeof value === "string") &&
    (state.generations === undefined ||
      (isRecord(state.generations) &&
        Object.values(state.generations).every(
          (value) =>
            typeof value === "number" &&
            Number.isSafeInteger(value) &&
            value >= 0,
        )))
  );
}
const mediaListeners = new Set<(store: OfflineStorage) => void>();
export function subscribeOfflineMediaChanges(
  listener: (store: OfflineStorage) => void,
) {
  mediaListeners.add(listener);
  return () => {
    mediaListeners.delete(listener);
  };
}
export function notifyOfflineMediaChanges(store: OfflineStorage) {
  for (const listener of mediaListeners) {
    try {
      listener(store);
    } catch {
      /* Media cleanup cannot undo a committed write. */
    }
  }
}
const transactions = new WeakMap<OfflineStorage, Promise<unknown>>();
// Shared by library instances so a request begun before a local mutation cannot
// replace that mutation after its queue entry has already synchronized.
const revisions = new WeakMap<OfflineStorage, Map<string, number>>();
/** Also used by image cleanup so references cannot change during deletion. */
export function offlineTransaction<T>(
  store: OfflineStorage,
  run: () => Promise<T>,
) {
  const next = (transactions.get(store) ?? Promise.resolve()).then(() =>
    store.withOfflineTransaction ? store.withOfflineTransaction(run) : run(),
  );
  transactions.set(
    store,
    next.catch(() => undefined),
  );
  return next;
}
// Comparing only image-bearing input avoids reparsing Markdown and scanning
// every saved owner after a progress-only or identical server refresh.
function sameQuizMedia(
  previous: QuizWithUserProgress,
  next: QuizWithUserProgress,
) {
  return (
    previous.questions.length === next.questions.length &&
    previous.questions.every((question, index) => {
      const other = next.questions[index];
      return (
        question.image === other.image &&
        question.text === other.text &&
        question.explanation === other.explanation &&
        question.answers.length === other.answers.length &&
        question.answers.every((answer, answerIndex) => {
          const otherAnswer = other.answers[answerIndex];
          return (
            answer.image === otherAnswer.image &&
            answer.text === otherAnswer.text
          );
        })
      );
    })
  );
}
export class OfflineLibrary {
  private syncing: Promise<void> | null = null;
  constructor(
    private userId: string,
    private store: OfflineStorage,
    private api: ApiClient,
  ) {}
  async read() {
    const state = (await (this.store.readStrict ?? this.store.read).call(
      this.store,
      `offline.${this.userId}`,
      emptyState(),
    )) as OfflineState;
    if (!validState(state)) throw new UserFacingError("localData");
    return state;
  }
  snapshot(quizId: string) {
    return revisions.get(this.store)?.get(`${this.userId}\0${quizId}`) ?? 0;
  }
  captureSnapshot(quizId: string, state: OfflineState): OfflineSnapshot {
    return {
      localRevision: this.snapshot(quizId),
      generation: state.generations?.[quizId] ?? 0,
    };
  }
  matchesSnapshot(
    quizId: string,
    snapshot: OfflineSnapshot,
    state: OfflineState,
  ) {
    return (
      snapshot.localRevision === this.snapshot(quizId) &&
      snapshot.generation === (state.generations?.[quizId] ?? 0)
    );
  }
  private mutate<T>(
    quizId: string,
    fn: (state: OfflineState, unchanged: () => void) => T,
  ) {
    return offlineTransaction(this.store, async () => {
      const state = await this.read();
      let changed = true;
      const result = fn(state, () => {
        changed = false;
      });
      if (!changed) return result;
      state.generations = {
        ...state.generations,
        [quizId]: (state.generations?.[quizId] ?? 0) + 1,
      };
      if (!validState(state)) throw new UserFacingError("localData");
      try {
        await this.store.write(`offline.${this.userId}`, state);
      } catch (error) {
        throw explainQuizStorageFailure(error, state, quizId);
      }
      let current = revisions.get(this.store);
      if (!current) revisions.set(this.store, (current = new Map()));
      current.set(`${this.userId}\0${quizId}`, this.snapshot(quizId) + 1);
      return result;
    });
  }
  async cache(quiz: QuizWithUserProgress, snapshot?: OfflineSnapshot) {
    if (!validSavedQuiz(quiz)) throw new UserFacingError("localData");
    let replaced = false;
    const retained = await this.mutate(quiz.id, (state, unchanged) => {
      if (
        (!snapshot || this.matchesSnapshot(quiz.id, snapshot, state)) &&
        !state.queue.some((x) => x.quiz_id === quiz.id)
      ) {
        const previous = state.quizzes[quiz.id];
        replaced = !!previous && !sameQuizMedia(previous, quiz);
        state.quizzes[quiz.id] = quiz;
      } else unchanged();
      return state.quizzes[quiz.id];
    });
    if (replaced) notifyOfflineMediaChanges(this.store);
    return retained;
  }
  async enqueue(item: PendingAnswer, quiz: QuizWithUserProgress) {
    if (!Number.isInteger(item.version) || item.version < 0)
      throw new UserFacingError("quizRefresh");
    if (!validSavedQuiz(quiz) || !validPendingAnswer(item))
      throw new UserFacingError("localData");
    await this.mutate(quiz.id, (state, unchanged) => {
      // Retain rejected answers for explicit recovery, but do not build a queue
      // that cannot be submitted against the server's current quiz/session.
      if (state.errors[quiz.id]) throw new UserFacingError("syncConflict");
      if (state.queue.some((x) => x.request_id === item.request_id)) {
        unchanged();
        return;
      }
      const incoming = quiz.current_session;
      const last = incoming?.answers.at(-1);
      if (
        item.quiz_id !== quiz.id ||
        incoming?.id !== item.session_id ||
        last?.id !== item.local.id ||
        last.question !== item.local.question
      )
        throw new UserFacingError("localData");
      const saved = state.quizzes[quiz.id];
      const before = incoming.answers.slice(0, -1);
      // Acknowledgement replaces local answer IDs with server IDs, while the
      // ordered question history stays stable. Do not mistake that for an edit.
      if (
        (!saved && (state.generations?.[quiz.id] ?? 0) > 0) ||
        (saved &&
          (saved.version !== item.version ||
            saved.current_session?.id !== item.session_id ||
            saved.current_session.answers.length !== before.length ||
            saved.current_session.answers.some(
              (answer, index) => answer.question !== before[index]?.question,
            )))
      )
        throw new UserFacingError("quizProgressChanged");
      state.queue.push(item);
      // The matched prefix may have acquired server IDs since this view loaded.
      // Keep those canonical records; only this newly checked answer is added.
      state.quizzes[quiz.id] = saved?.current_session
        ? {
            ...quiz,
            current_session: {
              ...incoming,
              answers: [...saved.current_session.answers, item.local],
            },
          }
        : quiz;
    });
  }
  async remove(quizId: string) {
    await this.mutate(quizId, (state) => {
      if (state.queue.some((x) => x.quiz_id === quizId))
        throw new UserFacingError("pendingAnswers");
      delete state.quizzes[quizId];
      delete state.errors[quizId];
    });
    notifyOfflineMediaChanges(this.store);
  }
  async discard(quizId: string) {
    await this.mutate(quizId, (state) => {
      state.queue = state.queue.filter((x) => x.quiz_id !== quizId);
      delete state.quizzes[quizId];
      delete state.errors[quizId];
    });
    notifyOfflineMediaChanges(this.store);
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
      // Removing a quiz can discard queued answers while a previous request is
      // in flight. Do not send later entries from the initial queue snapshot.
      if (
        !(await this.read()).queue.some((x) => x.request_id === item.request_id)
      )
        continue;
      try {
        const { quiz_id, local, ...payload } = item;
        const record = await this.api.post<AnswerRecord>(
          `mobile/quizzes/${quiz_id}/answer/`,
          payload,
        );
        await this.mutate(item.quiz_id, (state, unchanged) => {
          if (!state.queue.some((x) => x.request_id === item.request_id)) {
            unchanged();
            return;
          }
          state.queue = state.queue.filter(
            (x) => x.request_id !== item.request_id,
          );
          delete state.errors[quiz_id];
          const session = state.quizzes[quiz_id]?.current_session;
          // HTTP success acknowledges this request even if its response body
          // is unusable. Keep the saved local result instead of corrupting it.
          if (
            session &&
            validAnswerRecord(record) &&
            record.question === item.question_id
          )
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
          await this.mutate(item.quiz_id, (state, unchanged) => {
            if (state.queue.some((x) => x.request_id === item.request_id))
              state.errors[item.quiz_id] = error.message;
            else unchanged();
          });
        } else throw error;
      }
    }
  }
}
