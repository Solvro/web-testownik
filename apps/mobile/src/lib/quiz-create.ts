import type { Quiz } from "@testownik/core/quiz/types";
import type { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import { ApiError, type ApiClient } from "./client";
import {
  MAX_CHUNK_VALUE_BYTES,
  storedValueBytes,
} from "./android-chunk-storage";
import { isQuizVersion, type EditorDraft } from "./editor-draft";

export type CreatePayload = ReturnType<typeof prepareQuizForSubmission>;
export interface CreateResult {
  request_id: string;
  status: "created";
  quiz: Quiz;
  created_version: number;
  id_map: {
    questions: Record<string, string>;
    answers: Record<string, string>;
  };
}
interface DeletedResult {
  request_id: string;
  status: "deleted";
  quiz_id: string;
  created_version: number;
  id_map: CreateResult["id_map"];
}
interface LegacyOperation {
  schemaVersion: 1;
  owner: string;
  requestId: string;
  snapshot: EditorDraft;
  payload: CreatePayload;
  state: "pending" | "created" | "rejected" | "deleted" | "access-lost";
  result?: CreateResult;
  deleted?: DeletedResult;
  /** A known PATCH acknowledgement also survives a later local cleanup failure. */
  acknowledged?: { snapshot: EditorDraft; quiz: Quiz };
}
export interface QuizRef {
  id: string;
  version: number;
}
export interface CreateReceipt extends Omit<CreateResult, "quiz"> {
  quiz: QuizRef;
}
export interface QuizCreateOperation {
  schemaVersion: 1 | 2;
  owner: string;
  requestId: string;
  snapshot: EditorDraft;
  payload?: CreatePayload;
  state: "pending" | "created" | "rejected" | "deleted" | "access-lost";
  result?: CreateReceipt;
  deleted?: { quiz_id: string; created_version: number };
  acknowledged?: { snapshot: EditorDraft; quiz: QuizRef };
}
export interface CreateStorage {
  withCreateTransaction?<T>(owner: string, run: () => Promise<T>): Promise<T>;
  readStrict<T>(key: string, fallback: T): Promise<T>;
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
/** Acquired after the per-context queue and before account-data leaf writes. */
export function createTransaction<T>(
  store: CreateStorage,
  owner: string,
  run: () => Promise<T>,
): Promise<T> {
  return store.withCreateTransaction
    ? store.withCreateTransaction(owner, run)
    : run();
}
export class QuizCreateError extends Error {
  constructor(
    public reason:
      | "local"
      | "response"
      | "rejected"
      | "deleted"
      | "access-lost"
      | "size"
      | "superseded",
  ) {
    super(`Quiz create recovery: ${reason}`);
  }
}
const queues = new WeakMap<CreateStorage, Map<string, Promise<unknown>>>();
export const quizCreateKey = (owner: string) => `quiz-create.${owner}.new`;
function exclusive<T>(
  store: CreateStorage,
  owner: string,
  run: () => Promise<T>,
) {
  let queue = queues.get(store);
  if (!queue) {
    queue = new Map();
    queues.set(store, queue);
  }
  const key = quizCreateKey(owner);
  const next = (queue.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(run);
  queue.set(key, next);
  const clear = () => {
    if (queue.get(key) === next) queue.delete(key);
  };
  void next.then(clear, clear);
  return next;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
function draft(value: unknown): value is EditorDraft {
  return (
    object(value) &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.questions) &&
    value.questions.every(
      (q) =>
        object(q) &&
        uuid(q.id) &&
        typeof q.text === "string" &&
        Array.isArray(q.answers) &&
        q.answers.every(
          (a) => object(a) && uuid(a.id) && typeof a.text === "string",
        ),
    )
  );
}
function quiz(value: unknown): value is Quiz {
  return (
    draft(value) &&
    object(value) &&
    uuid(value.id) &&
    isQuizVersion(value.version)
  );
}
function maps(value: unknown): value is CreateResult["id_map"] {
  return (
    object(value) &&
    [value.questions, value.answers].every(
      (map) =>
        object(map) &&
        Object.entries(map).every(([from, to]) => uuid(from) && uuid(to)) &&
        new Set(Object.values(map)).size === Object.keys(map).length,
    )
  );
}
function mappedId(map: Record<string, string>, id: string) {
  return map[id] ?? map[id.toLowerCase()];
}
function completeMappings(
  snapshot: EditorDraft,
  idMap: CreateResult["id_map"],
) {
  return snapshot.questions.every(
    (q) =>
      mappedId(idMap.questions, q.id) &&
      q.answers.every((a) => mappedId(idMap.answers, a.id)),
  );
}
function result(value: unknown, requestId: string): value is CreateResult {
  return (
    object(value) &&
    value.request_id === requestId &&
    value.status === "created" &&
    quiz(value.quiz) &&
    isQuizVersion(value.created_version) &&
    value.quiz.version >= value.created_version &&
    maps(value.id_map)
  );
}
function deleted(value: unknown, requestId: string): value is DeletedResult {
  return (
    object(value) &&
    value.request_id === requestId &&
    value.status === "deleted" &&
    uuid(value.quiz_id) &&
    isQuizVersion(value.created_version) &&
    maps(value.id_map)
  );
}
function legacyOperation(
  value: unknown,
  owner: string,
): value is LegacyOperation {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.owner !== owner ||
    !uuid(value.requestId) ||
    !draft(value.snapshot) ||
    !draft(value.payload)
  )
    return false;
  if (
    !["pending", "created", "rejected", "deleted", "access-lost"].includes(
      String(value.state),
    )
  )
    return false;
  if (
    value.state !== "created" &&
    (value.result !== undefined || value.acknowledged !== undefined)
  )
    return false;
  if (value.state !== "deleted" && value.deleted !== undefined) return false;
  if (
    value.state === "created" &&
    (!result(value.result, value.requestId) ||
      !completeMappings(value.snapshot, value.result.id_map) ||
      !object(value.acknowledged) ||
      !draft(value.acknowledged.snapshot) ||
      !quiz(value.acknowledged.quiz))
  )
    return false;
  if (
    value.state === "created" &&
    object(value.acknowledged) &&
    object(value.result) &&
    object(value.result.quiz) &&
    object(value.acknowledged.quiz) &&
    value.result.quiz.id !== value.acknowledged.quiz.id
  )
    return false;
  if (value.state === "deleted" && !deleted(value.deleted, value.requestId))
    return false;
  return true;
}
export function adoptCreatedDraft(
  value: EditorDraft,
  saved: Pick<CreateResult, "created_version" | "id_map">,
): EditorDraft {
  return {
    ...value,
    schemaVersion: 1,
    baseVersion: value.baseVersion ?? saved.created_version,
    questions: value.questions.map((q) => ({
      ...q,
      id: mappedId(saved.id_map.questions, q.id) ?? q.id,
      answers: q.answers.map((a) => ({
        ...a,
        id: mappedId(saved.id_map.answers, a.id) ?? a.id,
      })),
    })),
  };
}
export function sameDraftContent(a: EditorDraft, b: EditorDraft) {
  const content = ({ title, description, questions }: EditorDraft) => ({
    title,
    description,
    questions,
  });
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}
export function resolveQuizCreateResult(
  response: unknown,
  requestId: string,
  snapshot: EditorDraft,
): CreateResult {
  // The server permits nullable descriptions; editor drafts use empty text.
  if (
    object(response) &&
    object(response.quiz) &&
    response.quiz.description === null
  )
    response = { ...response, quiz: { ...response.quiz, description: "" } };
  if (
    !result(response, requestId) ||
    !completeMappings(snapshot, response.id_map)
  )
    throw new QuizCreateError("response");
  return response;
}
export function quizCreateFailure(
  failure: unknown,
  requestId: string,
): "rejected" | "deleted" | "access-lost" | null {
  if (
    !(failure instanceof ApiError) ||
    !object(failure.body) ||
    failure.body.request_id !== requestId
  )
    return null;
  if (
    failure.status === 400 &&
    failure.body.status === "rejected" &&
    failure.body.code === "validation_failed"
  )
    return "rejected";
  if (failure.status === 403 && failure.body.code === "create_access_lost")
    return "access-lost";
  if (failure.status === 410 && deleted(failure.body, requestId))
    return "deleted";
  return null;
}

interface Base2 {
  schemaVersion: 2;
  owner: string;
  requestId: string;
}
interface StoredPending extends Base2 {
  state: "pending";
  snapshot: EditorDraft;
  payload: CreatePayload;
}
interface CreatedBase extends Base2 {
  state: "created";
  result: CreateReceipt;
  mapped: { questions: number; answers: number };
}
// Keep one draft: derive the original acknowledgement from its ID map, then
// replace that draft only when a later PATCH acknowledges different content.
type StoredCreated = CreatedBase &
  (
    | { snapshot: EditorDraft; acknowledged?: { quiz: QuizRef } }
    | {
        snapshot?: never;
        acknowledged: { snapshot: EditorDraft; quiz: QuizRef };
      }
  );
type Stored2 =
  | StoredPending
  | StoredCreated
  | (Base2 &
      (
        | { state: "rejected" | "access-lost"; snapshot: EditorDraft }
        | {
            state: "deleted";
            snapshot: EditorDraft;
            deleted: { quiz_id: string; created_version: number };
          }
      ));
type Stored = LegacyOperation | Stored2;
const baseKeys = ["schemaVersion", "owner", "requestId", "state"];
function keys(v: Record<string, unknown>, required: string[]) {
  return (
    Object.keys(v).length === required.length &&
    required.every((key) => Object.hasOwn(v, key))
  );
}
function reference(v: unknown): v is QuizRef {
  return (
    object(v) &&
    keys(v, ["id", "version"]) &&
    uuid(v.id) &&
    isQuizVersion(v.version)
  );
}
function ref(v: QuizRef): QuizRef {
  return { id: v.id, version: v.version };
}
function snapshot(v: unknown): v is EditorDraft {
  return (
    draft(v) &&
    v.schemaVersion === 1 &&
    (v.baseVersion === undefined || isQuizVersion(v.baseVersion))
  );
}
function receipt(v: unknown, requestId: string): v is CreateReceipt {
  return (
    object(v) &&
    keys(v, ["request_id", "status", "quiz", "created_version", "id_map"]) &&
    v.request_id === requestId &&
    v.status === "created" &&
    reference(v.quiz) &&
    isQuizVersion(v.created_version) &&
    v.quiz.version >= v.created_version &&
    maps(v.id_map) &&
    keys(v.id_map, ["questions", "answers"])
  );
}
function mapCounts(
  v: unknown,
  map: CreateResult["id_map"],
): v is StoredCreated["mapped"] {
  return (
    object(v) &&
    keys(v, ["questions", "answers"]) &&
    Number.isSafeInteger(v.questions) &&
    Number(v.questions) >= 0 &&
    Number.isSafeInteger(v.answers) &&
    Number(v.answers) >= 0 &&
    v.questions === Object.keys(map.questions).length &&
    v.answers === Object.keys(map.answers).length
  );
}
function exactMappings(source: EditorDraft, map: CreateResult["id_map"]) {
  return (
    completeMappings(source, map) &&
    Object.keys(map.questions).length ===
      new Set(source.questions.map((q) => q.id.toLowerCase())).size &&
    Object.keys(map.answers).length ===
      new Set(
        source.questions.flatMap((q) =>
          q.answers.map((a) => a.id.toLowerCase()),
        ),
      ).size
  );
}
function stored2(v: unknown, owner: string): v is Stored2 {
  if (
    !object(v) ||
    v.schemaVersion !== 2 ||
    v.owner !== owner ||
    !uuid(v.requestId)
  )
    return false;
  if (v.state === "pending")
    return (
      keys(v, [...baseKeys, "snapshot", "payload"]) &&
      snapshot(v.snapshot) &&
      draft(v.payload)
    );
  if (v.state === "rejected" || v.state === "access-lost")
    return keys(v, [...baseKeys, "snapshot"]) && snapshot(v.snapshot);
  if (v.state === "deleted")
    return (
      keys(v, [...baseKeys, "snapshot", "deleted"]) &&
      snapshot(v.snapshot) &&
      object(v.deleted) &&
      keys(v.deleted, ["quiz_id", "created_version"]) &&
      uuid(v.deleted.quiz_id) &&
      isQuizVersion(v.deleted.created_version)
    );
  if (
    v.state !== "created" ||
    !receipt(v.result, v.requestId) ||
    !mapCounts(v.mapped, v.result.id_map)
  )
    return false;
  const required = [...baseKeys, "result", "mapped"];
  if (v.acknowledged === undefined)
    return (
      keys(v, [...required, "snapshot"]) &&
      snapshot(v.snapshot) &&
      exactMappings(v.snapshot, v.result.id_map)
    );
  if (
    !object(v.acknowledged) ||
    !reference(v.acknowledged.quiz) ||
    v.acknowledged.quiz.id !== v.result.quiz.id ||
    v.acknowledged.quiz.version < v.result.created_version
  )
    return false;
  if (v.acknowledged.snapshot === undefined)
    return (
      keys(v, [...required, "snapshot", "acknowledged"]) &&
      keys(v.acknowledged, ["quiz"]) &&
      snapshot(v.snapshot) &&
      exactMappings(v.snapshot, v.result.id_map)
    );
  return (
    keys(v, [...required, "acknowledged"]) &&
    keys(v.acknowledged, ["quiz", "snapshot"]) &&
    snapshot(v.acknowledged.snapshot) &&
    v.acknowledged.snapshot.baseVersion === v.acknowledged.quiz.version
  );
}
async function readStored(
  store: CreateStorage,
  owner: string,
): Promise<Stored | null> {
  const saved = await store.readStrict<unknown>(quizCreateKey(owner), null);
  if (saved === null) return null;
  if (legacyOperation(saved, owner) || stored2(saved, owner)) return saved;
  throw new QuizCreateError("local");
}
function fits(v: Stored2) {
  if (storedValueBytes(v) > MAX_CHUNK_VALUE_BYTES)
    throw new QuizCreateError("size");
}
async function persist2(store: CreateStorage, value: Stored2) {
  if (!stored2(value, value.owner)) throw new QuizCreateError("response");
  fits(value);
  await store.write(quizCreateKey(value.owner), value);
  if (
    JSON.stringify(await readStored(store, value.owner)) !==
    JSON.stringify(value)
  )
    throw new QuizCreateError("local");
}
function view(saved: Stored): QuizCreateOperation {
  const common = {
    schemaVersion: saved.schemaVersion,
    owner: saved.owner,
    requestId: saved.requestId,
    state: saved.state,
  };
  if (saved.schemaVersion === 1)
    return {
      ...common,
      snapshot: saved.snapshot,
      ...(saved.state === "pending" ? { payload: saved.payload } : {}),
      ...(saved.result
        ? { result: compactReceipt(saved.snapshot, saved.result) }
        : {}),
      ...(saved.deleted
        ? {
            deleted: {
              quiz_id: saved.deleted.quiz_id,
              created_version: saved.deleted.created_version,
            },
          }
        : {}),
      ...(saved.acknowledged
        ? {
            acknowledged: {
              snapshot: saved.acknowledged.snapshot,
              quiz: ref(saved.acknowledged.quiz),
            },
          }
        : {}),
    };
  if (saved.state !== "created")
    return {
      ...common,
      snapshot: saved.snapshot,
      ...(saved.state === "pending" ? { payload: saved.payload } : {}),
      ...(saved.state === "deleted" ? { deleted: saved.deleted } : {}),
    };
  const acknowledged = saved.snapshot
    ? {
        snapshot: {
          ...adoptCreatedDraft(saved.snapshot, saved.result),
          ...(saved.acknowledged
            ? { baseVersion: saved.acknowledged.quiz.version }
            : {}),
        },
        // A replay may return newer server content; the acknowledged draft
        // still belongs to the original create version until a PATCH commits.
        quiz: saved.acknowledged?.quiz ?? {
          id: saved.result.quiz.id,
          version: saved.result.created_version,
        },
      }
    : saved.acknowledged!;
  return {
    ...common,
    snapshot: saved.snapshot ?? acknowledged.snapshot,
    result: saved.result,
    acknowledged,
  };
}
export const loadQuizCreate = (store: CreateStorage, owner: string) =>
  exclusive(store, owner, async () => {
    const saved = await readStored(store, owner);
    return saved ? view(saved) : null;
  });
function pruneMaps(
  source: EditorDraft,
  original: CreateResult["id_map"],
): CreateResult["id_map"] {
  const pruned: CreateResult["id_map"] = { questions: {}, answers: {} };
  const add = (kind: "questions" | "answers", id: string) => {
    const key = original[kind][id] !== undefined ? id : id.toLowerCase();
    const target = original[kind][key];
    if (!target) throw new QuizCreateError("response");
    pruned[kind][key] = target;
  };
  for (const q of source.questions) {
    add("questions", q.id);
    for (const a of q.answers) add("answers", a.id);
  }
  return pruned;
}
function compactReceipt(
  source: EditorDraft,
  confirmed: CreateResult,
): CreateReceipt {
  return {
    request_id: confirmed.request_id,
    status: "created",
    quiz: ref(confirmed.quiz),
    created_version: confirmed.created_version,
    id_map: pruneMaps(source, confirmed.id_map),
  };
}
function mapped(result: CreateReceipt) {
  return {
    questions: Object.keys(result.id_map.questions).length,
    answers: Object.keys(result.id_map.answers).length,
  };
}
function initialReceipt(
  pending: StoredPending,
  result: CreateReceipt,
): StoredCreated {
  return {
    schemaVersion: 2,
    owner: pending.owner,
    requestId: pending.requestId,
    state: "created",
    snapshot: pending.snapshot,
    result,
    mapped: mapped(result),
  };
}
function preflight(pending: StoredPending) {
  fits(pending);
  const id_map: CreateResult["id_map"] = { questions: {}, answers: {} };
  for (const q of pending.snapshot.questions) {
    id_map.questions[q.id] = q.id.toLowerCase();
    for (const a of q.answers) id_map.answers[a.id] = a.id.toLowerCase();
  }
  const identity = {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    version: Number.MAX_SAFE_INTEGER,
  };
  const result: CreateReceipt = {
    request_id: pending.requestId,
    status: "created",
    quiz: identity,
    created_version: Number.MAX_SAFE_INTEGER,
    id_map,
  };
  fits({
    schemaVersion: 2,
    owner: pending.owner,
    requestId: pending.requestId,
    state: "created",
    snapshot: pending.snapshot,
    result,
    mapped: mapped(result),
    acknowledged: { quiz: identity },
  });
}
/** Never persists server quiz bodies; later server edits cannot enlarge this journal. */
export function createQuiz(options: {
  store: CreateStorage;
  owner: string;
  snapshot: EditorDraft;
  payload: CreatePayload;
  newId: () => string;
  post: (body: { request_id: string; quiz: CreatePayload }) => Promise<unknown>;
}) {
  const { store, owner } = options;
  return exclusive(store, owner, async () => {
    const claimed = await createTransaction(store, owner, async () => {
      const saved = await readStored(store, owner);
      if (saved?.state === "created")
        return { kind: "created" as const, operation: view(saved) };
      if (saved?.state === "deleted") throw new QuizCreateError("deleted");
      if (saved?.state === "access-lost")
        throw new QuizCreateError("access-lost");
      const pending: StoredPending =
        saved?.state === "pending"
          ? {
              schemaVersion: 2,
              owner,
              requestId: saved.requestId,
              state: "pending",
              snapshot: saved.snapshot,
              payload: saved.payload,
            }
          : (JSON.parse(
              JSON.stringify({
                schemaVersion: 2,
                owner,
                requestId: options.newId(),
                state: "pending",
                snapshot: options.snapshot,
                payload: options.payload,
              }),
            ) as StoredPending);
      if (!saved || saved.state === "rejected") {
        if (!stored2(pending, owner)) throw new QuizCreateError("local");
        preflight(pending);
        await persist2(store, pending);
      }
      return { kind: "pending" as const, pending };
    });
    if (claimed.kind === "created") return claimed.operation;
    const pending = claimed.pending;
    let response: unknown;
    try {
      response = await options.post({
        request_id: pending.requestId,
        quiz: pending.payload,
      });
    } catch (failure) {
      const outcome = quizCreateFailure(failure, pending.requestId);
      if (!outcome) throw failure;
      const base = {
        schemaVersion: 2 as const,
        owner,
        requestId: pending.requestId,
        snapshot: pending.snapshot,
      };
      const terminal: Stored2 =
        outcome === "deleted"
          ? {
              ...base,
              state: "deleted",
              deleted: {
                quiz_id: ((failure as ApiError).body as DeletedResult).quiz_id,
                created_version: ((failure as ApiError).body as DeletedResult)
                  .created_version,
              },
            }
          : { ...base, state: outcome };
      const settled = await settleCreate(store, pending, terminal);
      if (settled.state === "created") return settled;
      throw new QuizCreateError(outcome);
    }
    const confirmed = resolveQuizCreateResult(
      response,
      pending.requestId,
      pending.snapshot,
    );
    const created = initialReceipt(
      pending,
      compactReceipt(pending.snapshot, confirmed),
    );
    return settleCreate(store, pending, created);
  });
}
/** A late response must never recreate a removed journal or overwrite a newer claim. */
function settleCreate(
  store: CreateStorage,
  pending: StoredPending,
  candidate: Stored2,
) {
  return createTransaction(store, pending.owner, async () => {
    const current = await readStored(store, pending.owner);
    if (!current || current.requestId !== pending.requestId)
      throw new QuizCreateError("superseded");
    if (current.state === "created") {
      const known = view(current);
      // An initial create acknowledgement does not override a later explicit
      // deletion/access-loss proof. A subsequent PATCH acknowledgement does.
      if (
        (candidate.state === "deleted" || candidate.state === "access-lost") &&
        known.result &&
        (known.acknowledged?.quiz.version ?? known.result.created_version) <=
          known.result.created_version
      ) {
        await persist2(store, candidate);
        return view(candidate);
      }
      return known;
    }
    if (current.state !== "pending") throw new QuizCreateError(current.state);
    await persist2(store, candidate);
    return view(candidate);
  });
}
function compactExisting(saved: Stored): StoredCreated {
  if (saved.state !== "created") throw new QuizCreateError("local");
  if (saved.schemaVersion === 2) return saved;
  if (!saved.result || !saved.acknowledged) throw new QuizCreateError("local");
  const result = compactReceipt(saved.snapshot, saved.result);
  return {
    schemaVersion: 2,
    owner: saved.owner,
    requestId: saved.requestId,
    state: "created",
    snapshot: saved.snapshot,
    result,
    mapped: mapped(result),
  };
}
function patchAcknowledgement(
  saved: StoredCreated,
  submitted: EditorDraft,
  quiz: QuizRef,
): StoredCreated {
  const base = {
    schemaVersion: 2 as const,
    owner: saved.owner,
    requestId: saved.requestId,
    state: "created" as const,
    result: saved.result,
    mapped: saved.mapped,
  };
  if (
    saved.snapshot &&
    sameDraftContent(submitted, adoptCreatedDraft(saved.snapshot, saved.result))
  )
    return {
      ...base,
      snapshot: saved.snapshot,
      acknowledged: { quiz: ref(quiz) },
    };
  return {
    ...base,
    acknowledged: {
      snapshot: { ...submitted, baseVersion: quiz.version },
      quiz: ref(quiz),
    },
  };
}
/** Exact upper bound for the compact acknowledgement before a subsequent PATCH. */
export function assertQuizCreateAckFits(
  operation: QuizCreateOperation,
  submitted: EditorDraft,
) {
  if (operation.state !== "created" || !operation.result)
    throw new QuizCreateError("local");
  const candidate: StoredCreated = {
    schemaVersion: 2,
    owner: operation.owner,
    requestId: operation.requestId,
    state: "created",
    result: operation.result,
    mapped: mapped(operation.result),
    acknowledged: {
      snapshot: { ...submitted, baseVersion: Number.MAX_SAFE_INTEGER },
      quiz: { id: operation.result.quiz.id, version: Number.MAX_SAFE_INTEGER },
    },
  };
  if (!stored2(candidate, operation.owner))
    throw new QuizCreateError("response");
  fits(candidate);
}
export function acknowledgeQuizCreate(
  store: CreateStorage,
  owner: string,
  requestId: string,
  submitted: EditorDraft,
  quiz: QuizRef,
) {
  return exclusive(store, owner, () =>
    createTransaction(store, owner, async () => {
      const saved = await readStored(store, owner);
      if (!saved || saved.state !== "created" || saved.requestId !== requestId)
        throw new QuizCreateError("local");
      const previous = view(saved);
      if (
        !uuid(quiz.id) ||
        !isQuizVersion(quiz.version) ||
        quiz.id !== previous.result?.quiz.id ||
        quiz.version < (previous.acknowledged?.quiz.version ?? 0)
      )
        throw new QuizCreateError("response");
      const updated = patchAcknowledgement(
        compactExisting(saved),
        submitted,
        quiz,
      );
      await persist2(store, updated);
      return view(updated);
    }),
  );
}
export function clearQuizCreate(
  store: CreateStorage,
  owner: string,
  requestId: string,
) {
  return exclusive(store, owner, () =>
    createTransaction(store, owner, async () => {
      const saved = await readStored(store, owner);
      if (saved && saved.requestId === requestId && saved.state !== "pending") {
        await store.remove(quizCreateKey(owner));
        if (await readStored(store, owner)) throw new QuizCreateError("local");
      }
    }),
  );
}
export const postQuizCreate = (
  client: Pick<ApiClient, "request">,
  body: { request_id: string; quiz: CreatePayload },
) =>
  client.request("mobile/quizzes/", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 120000,
  });
