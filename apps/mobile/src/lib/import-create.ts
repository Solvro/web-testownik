import { ApiError, type ApiClient } from "./client";
import {
  quizCreateFailure,
  createTransaction,
  type CreatePayload,
  type CreateStorage,
} from "./quiz-create";
import {
  MAX_CHUNK_VALUE_BYTES,
  storedValueBytes,
} from "./android-chunk-storage";
import { isQuizVersion } from "./editor-draft";

export type ImportPayload = CreatePayload & { visibility: 0 };
export interface ImportPreview {
  title: string;
  filename: string;
  questions: number;
  firstQuestion: string;
  firstAnswers: number;
}
interface Base {
  schemaVersion: 1;
  scope: "import";
  owner: string;
  requestId: string;
  preview: ImportPreview;
}
export type ImportOperation = Base &
  (
    | { state: "pending"; payload: ImportPayload }
    | {
        state: "created";
        created: { id: string; version: number };
      }
    | { state: "rejected" | "deleted" | "access-lost" }
  );
export class ImportCreateError extends Error {
  constructor(public reason: "local" | "occupied" | "size" | "response") {
    super(`Import recovery: ${reason}`);
  }
}
export const importCreateKey = (owner: string) => `quiz-create.${owner}.import`;
// Leave room for the bounded preview/envelope under Android's 8 MiB value cap.
export const MAX_IMPORT_RECORD_BYTES = MAX_CHUNK_VALUE_BYTES - 4096;
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function payload(v: unknown): v is ImportPayload {
  return (
    object(v) &&
    typeof v.title === "string" &&
    v.title.length > 0 &&
    v.title.length <= 200 &&
    typeof v.description === "string" &&
    v.visibility === 0 &&
    Array.isArray(v.questions) &&
    v.questions.length > 0 &&
    v.questions.length <= 10000 &&
    v.questions.every(
      (q) =>
        object(q) &&
        uuid(q.id) &&
        typeof q.text === "string" &&
        typeof q.multiple === "boolean" &&
        Number.isInteger(q.order) &&
        Number(q.order) >= 0 &&
        Array.isArray(q.answers) &&
        q.answers.length > 0 &&
        q.answers.length <= 100 &&
        q.answers.every(
          (a) =>
            object(a) &&
            uuid(a.id) &&
            typeof a.text === "string" &&
            typeof a.is_correct === "boolean" &&
            Number.isInteger(a.order) &&
            Number(a.order) >= 0,
        ),
    )
  );
}
function preview(v: unknown): v is ImportPreview {
  return (
    object(v) &&
    typeof v.title === "string" &&
    v.title.length <= 200 &&
    typeof v.filename === "string" &&
    v.filename.length <= 200 &&
    Number.isInteger(v.questions) &&
    Number(v.questions) > 0 &&
    Number(v.questions) <= 10000 &&
    typeof v.firstQuestion === "string" &&
    v.firstQuestion.length <= 300 &&
    Number.isInteger(v.firstAnswers) &&
    Number(v.firstAnswers) > 0 &&
    Number(v.firstAnswers) <= 100
  );
}
function valid(v: unknown, owner: string): v is ImportOperation {
  if (
    !object(v) ||
    v.schemaVersion !== 1 ||
    v.scope !== "import" ||
    v.owner !== owner ||
    !uuid(v.requestId) ||
    !preview(v.preview)
  )
    return false;
  if (v.state === "pending")
    return v.created === undefined && payload(v.payload);
  if (v.payload !== undefined) return false;
  if (v.state === "created")
    return (
      object(v.created) &&
      uuid(v.created.id) &&
      isQuizVersion(v.created.version)
    );
  return (
    ["rejected", "deleted", "access-lost"].includes(String(v.state)) &&
    v.created === undefined
  );
}
const queues = new WeakMap<CreateStorage, Map<string, Promise<unknown>>>();
function serial<T>(store: CreateStorage, owner: string, run: () => Promise<T>) {
  let map = queues.get(store);
  if (!map) {
    map = new Map();
    queues.set(store, map);
  }
  const key = importCreateKey(owner);
  const next = (map.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(run);
  map.set(key, next);
  const clear = () => {
    if (map.get(key) === next) map.delete(key);
  };
  void next.then(clear, clear);
  return next;
}
async function read(store: CreateStorage, owner: string) {
  let saved: unknown;
  try {
    saved = await store.readStrict<unknown>(importCreateKey(owner), null);
  } catch {
    throw new ImportCreateError("local");
  }
  if (saved === null) return null;
  if (!valid(saved, owner)) throw new ImportCreateError("local");
  return saved;
}
async function persist(store: CreateStorage, record: ImportOperation) {
  if (!valid(record, record.owner)) throw new ImportCreateError("local");
  if (storedValueBytes(record) > MAX_IMPORT_RECORD_BYTES)
    throw new ImportCreateError("size");
  try {
    await store.write(importCreateKey(record.owner), record);
  } catch {
    throw new ImportCreateError("local");
  }
  if (
    JSON.stringify(await read(store, record.owner)) !== JSON.stringify(record)
  )
    throw new ImportCreateError("local");
}
export function importPreview(
  quiz: CreatePayload,
  filename = "",
): ImportPreview {
  return {
    title: quiz.title.slice(0, 200),
    filename: filename.slice(0, 200),
    questions: quiz.questions.length,
    firstQuestion: quiz.questions[0]?.text.slice(0, 300) ?? "",
    firstAnswers: quiz.questions[0]?.answers.length ?? 0,
  };
}
/** Exclude source image bytes, which are uploaded and replaced by UUIDs before journaling. */
export function preflightImport(quiz: CreatePayload, filename = "") {
  const estimated = JSON.parse(JSON.stringify(quiz)) as CreatePayload;
  for (const q of estimated.questions)
    for (const item of [q, ...q.answers]) {
      if (item.image_url?.startsWith("data:image/")) {
        item.image_url = null;
        item.image_upload = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      }
    }
  const record = {
    schemaVersion: 1,
    scope: "import",
    owner: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    state: "pending",
    preview: importPreview(estimated, filename),
    payload: { ...estimated, visibility: 0 },
  };
  if (storedValueBytes(record) > MAX_IMPORT_RECORD_BYTES)
    throw new ImportCreateError("size");
}
export const loadImport = (store: CreateStorage, owner: string) =>
  serial(store, owner, () => read(store, owner));
export type ImportRequest = {
  request_id: string;
  quiz: ImportPayload;
};
type Post = (body: ImportRequest) => Promise<unknown>;
/** Large imports and their full replay response need the same deadline as media uploads. */
export const postImport = (
  client: Pick<ApiClient, "request">,
  body: ImportRequest,
) =>
  client.request("mobile/quizzes/", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 120000,
  });
async function send(
  store: CreateStorage,
  record: ImportOperation,
  post: Post,
  isCurrent: () => boolean,
) {
  if (record.state !== "pending") return record;
  if (!isCurrent())
    throw new ApiError(401, "Session ended", undefined, "signedOut");
  let response: unknown;
  const { payload: submitted, ...base } = record;
  try {
    response = await post({ request_id: record.requestId, quiz: submitted });
  } catch (failure) {
    const outcome = quizCreateFailure(failure, record.requestId);
    if (!outcome) throw failure;
    const terminal: ImportOperation = { ...base, state: outcome };
    return settleImport(store, record, terminal);
  }
  // Import needs proof of creation, rather than the editor's mappings for future PATCHes.
  if (
    !object(response) ||
    response.request_id !== record.requestId ||
    response.status !== "created" ||
    !object(response.quiz) ||
    !uuid(response.quiz.id) ||
    !isQuizVersion(response.quiz.version)
  )
    throw new ImportCreateError("response");
  // Terminal metadata is bounded; the full imported payload is no longer needed.
  const created: ImportOperation = {
    ...base,
    state: "created",
    created: {
      id: response.quiz.id,
      version: response.quiz.version,
    },
  };
  return settleImport(store, record, created);
}
function settleImport(
  store: CreateStorage,
  pending: ImportOperation,
  candidate: ImportOperation,
) {
  return createTransaction(store, pending.owner, async () => {
    const current = await read(store, pending.owner);
    if (!current || current.requestId !== pending.requestId)
      throw new ImportCreateError("local");
    // Import receipts contain only the initial create, never a later PATCH ACK.
    // Keep explicit matching deletion/access-loss proof from a delayed replay.
    if (
      current.state !== "pending" &&
      !(
        current.state === "created" &&
        (candidate.state === "deleted" || candidate.state === "access-lost")
      )
    )
      return current;
    await persist(store, candidate);
    return candidate;
  });
}
export function beginImport(options: {
  store: CreateStorage;
  owner: string;
  payload: ImportPayload;
  filename?: string;
  newId: () => string;
  post: Post;
  isCurrent?: () => boolean;
}) {
  return serial(options.store, options.owner, async () => {
    const record = await createTransaction(
      options.store,
      options.owner,
      async () => {
        if (await read(options.store, options.owner))
          throw new ImportCreateError("occupied");
        if (!(options.isCurrent ?? (() => true))())
          throw new ApiError(401, "Session ended", undefined, "signedOut");
        const frozen = JSON.parse(
          JSON.stringify(options.payload),
        ) as ImportPayload;
        const record: ImportOperation = {
          schemaVersion: 1,
          scope: "import",
          owner: options.owner,
          requestId: options.newId(),
          state: "pending",
          preview: importPreview(frozen, options.filename),
          payload: frozen,
        };
        await persist(options.store, record);
        return record;
      },
    );
    return send(
      options.store,
      record,
      options.post,
      options.isCurrent ?? (() => true),
    );
  });
}
export function resumeImport(options: {
  store: CreateStorage;
  owner: string;
  post: Post;
  isCurrent?: () => boolean;
}) {
  return serial(options.store, options.owner, async () => {
    const saved = await read(options.store, options.owner);
    if (!saved) throw new ImportCreateError("local");
    return send(
      options.store,
      saved,
      options.post,
      options.isCurrent ?? (() => true),
    );
  });
}
export function clearImport(
  store: CreateStorage,
  owner: string,
  requestId: string,
) {
  return serial(store, owner, () =>
    createTransaction(store, owner, async () => {
      const saved = await read(store, owner);
      if (!saved) return;
      if (saved.requestId !== requestId || saved.state === "pending")
        throw new ImportCreateError("occupied");
      try {
        await store.remove(importCreateKey(owner));
      } catch {
        throw new ImportCreateError("local");
      }
      if (await read(store, owner)) throw new ImportCreateError("local");
    }),
  );
}
