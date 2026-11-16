import type { OfflineState } from "./offline";
import {
  MAX_CHUNK_VALUE_BYTES,
  storedValueBytes,
} from "./android-chunk-storage";
import { UserFacingError, userError, type Translate } from "./user-error";

export type QuizStorageIssue = {
  code: "storageValueTooLarge" | "storageFull";
  fitsAlone: boolean | null;
  stale?: boolean;
};
export class QuizStorageError extends UserFacingError {
  constructor(public issue: QuizStorageIssue) {
    super(issue.code);
  }
}
export function quizStorageIssue(error: unknown): QuizStorageIssue | null {
  if (error instanceof QuizStorageError) return error.issue;
  if (!error || typeof error !== "object") return null;
  const code = "code" in error ? error.code : null;
  if (code === "storageValueTooLarge" || code === "storageFull")
    return { code, fitsAlone: null };
  if ("name" in error && error.name === "QuotaExceededError")
    return { code: "storageFull", fitsAlone: null };
  return null;
}
/** Only called after failed persistence; normal answer saves do no extra sizing. */
export function explainQuizStorageFailure(
  error: unknown,
  state: OfflineState,
  id: string,
) {
  const issue = quizStorageIssue(error);
  if (!issue) return error;
  if (issue.code === "storageValueTooLarge") {
    const solo: OfflineState = {
      quizzes: state.quizzes[id] ? { [id]: state.quizzes[id] } : {},
      queue: state.queue.filter((item) => item.quiz_id === id),
      errors: state.errors[id] ? { [id]: state.errors[id] } : {},
      ...(state.generations ? { generations: state.generations } : {}),
    };
    issue.fitsAlone = storedValueBytes(solo) <= MAX_CHUNK_VALUE_BYTES;
  }
  return new QuizStorageError(issue);
}
export function quizStorageMessage(issue: QuizStorageIssue, t: Translate) {
  const message =
    issue.code === "storageFull"
      ? userError(new UserFacingError("storageFull"), t)
      : issue.fitsAlone === false
        ? t(
            "Dane tego quizu przekraczają limit zapisu (8 MB), nawet bez innych zapisanych quizów. Wybierz mniejszy quiz. Dotychczasowe quizy i odpowiedzi są zachowane.",
            "This quiz’s data exceeds the storage limit (8 MB), even without other saved quizzes. Choose a smaller quiz. Your existing quizzes and answers are kept.",
          )
        : t(
            "Zapisane quizy na tym koncie przekraczają wspólny limit 8 MB. Usuń niepotrzebne quizy zapisane offline i spróbuj ponownie. Dotychczasowe quizy i odpowiedzi są zachowane.",
            "Saved quizzes for this account exceed their shared 8 MB limit. Remove unused saved quizzes, then try again. Your existing quizzes and answers are kept.",
          );
  return issue.stale
    ? `${message} ${t(
        "Wersja quizu na serwerze się zmieniła. Zaktualizuj zapisaną kopię przed sprawdzeniem kolejnej odpowiedzi.",
        "The quiz version on the server has changed. Update the saved copy before checking another answer.",
      )}`
    : message;
}

export function formatQuizStorageSize(bytes: number, language: "en" | "pl") {
  const mb = bytes >= 1024 * 1024;
  const value = bytes / (mb ? 1024 * 1024 : 1024);
  return `${value.toLocaleString(language === "pl" ? "pl-PL" : "en-GB", { maximumFractionDigits: mb ? 1 : 0 })} ${mb ? "MB" : "KB"}`;
}
