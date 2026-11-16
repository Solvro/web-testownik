const messages = {
  browserStorageCoordination: [
    "Nie udało się potwierdzić bezpiecznego zapisu między kartami przeglądarki. Otwórz podgląd przez HTTPS lub localhost w aktualnej przeglądarce, sprawdź dostęp do pamięci i spróbuj ponownie. Dotychczasowe dane są zachowane.",
    "Could not confirm safe storage across browser tabs. Open the preview over HTTPS or localhost in a current browser, check storage access, and try again. Your previously saved data is kept.",
  ],
  browserStorageLock: [
    "Ta przeglądarka nie udostępnia bezpiecznego zapisu między kartami. Otwórz podgląd przez HTTPS lub localhost w aktualnej przeglądarce i spróbuj ponownie. Dotychczasowe dane są zachowane.",
    "This browser cannot safely save data across tabs. Open the preview over HTTPS or localhost in a current browser and try again. Your previously saved data is kept.",
  ],
  sharingUnconfirmed: [
    "Nie udało się potwierdzić nadania dostępu. Odśwież uprawnienia przed ponownym dodaniem tej osoby lub grupy.",
    "Could not confirm access. Refresh permissions before adding this person or group again.",
  ],
  localData: [
    "Nie udało się odczytać danych z urządzenia. Zachowaliśmy je bez zmian. Spróbuj ponownie lub skontaktuj się z pomocą.",
    "Could not read the data saved on this device. It has been kept unchanged. Try again or contact support.",
  ],
  storageValueTooLarge: [
    "Te dane przekraczają limit zapisu na urządzeniu (8 MB). Dotychczasowe dane są zachowane.",
    "This data exceeds the device storage limit for one item (8 MB). Your previously saved data is kept.",
  ],
  storageFull: [
    "Brak miejsca na zapis danych. Usuń niepotrzebne quizy zapisane offline lub zwolnij miejsce na urządzeniu i spróbuj ponownie. Dotychczasowe dane są zachowane.",
    "Storage is full. Remove unused offline quizzes or free up device space, then try again. Your previously saved data is kept.",
  ],
  signIn: ["Zaloguj się ponownie.", "Please sign in again."],
  refresh: [
    "Nie udało się odnowić sesji. Spróbuj ponownie.",
    "Could not renew your session. Please try again.",
  ],
  signedOut: ["Sesja została zakończona.", "You have been signed out."],
  oauthState: [
    "Nieprawidłowa sesja logowania. Zacznij ponownie.",
    "This sign-in session is no longer valid. Please start again.",
  ],
  oauthResponse: [
    "Nie udało się zakończyć logowania. Spróbuj ponownie.",
    "Could not complete sign-in. Please try again.",
  ],
  oauthCancelled: ["Logowanie zostało anulowane.", "Sign-in was cancelled."],
  oauthFailed: [
    "Logowanie nie powiodło się. Spróbuj ponownie.",
    "Sign-in failed. Please try again.",
  ],
  maintenance: [
    "Przerwa techniczna. Spróbuj ponownie później.",
    "The service is temporarily unavailable. Please try again later.",
  ],
  throttled: [
    "Zbyt wiele prób. Odczekaj chwilę.",
    "Too many attempts. Please wait a moment and try again.",
  ],
  operation: [
    "Nie udało się wykonać operacji. Spróbuj ponownie.",
    "Could not complete this action. Please try again.",
  ],
  connection: [
    "Sprawdź połączenie i spróbuj ponownie.",
    "Check your connection and try again.",
  ],
  timeout: [
    "Odpowiedź trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie.",
    "The request took too long. Check your connection and try again.",
  ],
  missingQuestion: [
    "To pytanie nie jest już dostępne.",
    "This question is no longer available.",
  ],
  notFound: [
    "Nie znaleziono. Mogło zostać usunięte albo nie masz już dostępu.",
    "This isn’t available. It may have been deleted, or you no longer have access.",
  ],
  forbidden: [
    "Nie masz dostępu do tych treści.",
    "You don’t have access to this.",
  ],
  server: [
    "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
    "Something went wrong on our side. Please try again in a moment.",
  ],
  syncConflict: [
    "Serwer odrzucił zapisane odpowiedzi. Zostały na urządzeniu. Ponów synchronizację albo usuń lokalną kopię quizu, aby pobrać aktualną wersję. Usunięcie kopii spowoduje utratę niezsynchronizowanych odpowiedzi.",
    "The server rejected the saved answers. They are still on this device. Retry syncing or remove the local quiz copy to download the current version. Removing the copy loses its unsynced answers.",
  ],
  pendingAnswers: [
    "Najpierw zsynchronizuj odpowiedzi.",
    "Sync your answers first.",
  ],
  quizRefresh: [
    "Ta zapisana kopia quizu wymaga aktualizacji przed zapisaniem nowych odpowiedzi. Połącz się z internetem i sprawdź aktualizacje. Dotychczasowe odpowiedzi są zachowane.",
    "This saved quiz needs an update before new answers can be saved. Connect to the internet and retry updates. Your existing answers are kept.",
  ],
  quizProgressChanged: [
    "Postęp tego quizu zmienił się w innym miejscu. Wczytamy aktualny zapisany postęp. Zapisane odpowiedzi są zachowane; sprawdź pytanie przed ponowną próbą.",
    "Progress for this quiz changed elsewhere. We’ll load the current saved progress. Your saved answers are kept; check the question before trying again.",
  ],
} as const;

export type UserErrorCode = keyof typeof messages;
export type Translate = (pl: string, en: string) => string;

export class UserFacingError extends Error {
  constructor(public code: UserErrorCode) {
    super(messages[code][0]);
  }
}

// expo/fetch on Android appends the Java cause: "fetch failed: java.net.…".
const TRANSPORT =
  /^(?:Network request failed|Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|fetch failed)(?::[\s\S]*)?$/i;
// expo/fetch reports the client's AbortSignal.timeout as a cancelled request.
const TRANSPORT_TIMEOUT =
  /^fetch failed: (?:Fetch request has been canceled|java\.net\.SocketTimeoutException)/i;
// Django REST framework's stock 403/404 details say nothing useful to people.
const GENERIC_DETAIL =
  /^(?:Not found\.?|No \w+ matches the given query\.?|Nie znaleziono\.?|You do not have permission to perform this action\.?|Nie masz uprawnień do wykonania tej czynności\.?)$/i;

export type ErrorKind =
  | "offline"
  | "timeout"
  | "maintenance"
  | "throttled"
  | "signIn"
  | "notFound"
  | "forbidden"
  | "server"
  | "other";

function status(error: unknown) {
  return error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}

/** What went wrong, for picking an icon and title — not for the message. */
export function errorKind(error: unknown): ErrorKind {
  if (!(error instanceof Error)) return "offline";
  const code = "code" in error ? error.code : undefined;
  if (code === "maintenance") return "maintenance";
  if (code === "throttled") return "throttled";
  if (code === "signIn" || code === "refresh" || code === "signedOut")
    return "signIn";
  if (code === "connection") return "offline";
  if (
    code === "timeout" ||
    error.name === "TimeoutError" ||
    TRANSPORT_TIMEOUT.test(error.message)
  )
    return "timeout";
  if (TRANSPORT.test(error.message)) return "offline";
  const http = status(error);
  if (http === 401) return "signIn";
  if (http === 404) return "notFound";
  if (http === 403) return "forbidden";
  if (http === 503) return "maintenance";
  if (http !== undefined && http >= 500) return "server";
  return "other";
}

/** Localize app-owned failures without replacing useful server validation. */
export function userError(error: unknown, t: Translate): string {
  if (error instanceof Error) {
    const code = "code" in error ? error.code : undefined;
    const http = status(error);
    if (
      (http === 404 || http === 403) &&
      (code === "operation" || GENERIC_DETAIL.test(error.message))
    )
      return http === 404 ? t(...messages.notFound) : t(...messages.forbidden);
    if (
      http !== undefined &&
      http >= 500 &&
      http !== 503 &&
      code === "operation"
    )
      return t(...messages.server);
    if (typeof code === "string" && Object.hasOwn(messages, code)) {
      const [pl, en] = messages[code as UserErrorCode];
      return t(pl, en);
    }
    if (error.name === "TimeoutError" || TRANSPORT_TIMEOUT.test(error.message))
      return t(...messages.timeout);
    if (TRANSPORT.test(error.message)) return t(...messages.connection);
    if (error.message) return error.message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return t(...messages.connection);
}

/** Alert title for a failed action: "Couldn’t Delete Quiz" beats "Error". */
export function failureTitle(t: Translate, action?: string): string {
  const name = action?.replace(/…$/, "").trim();
  return name
    ? t("Nie udało się", `Couldn’t ${name}`)
    : t("Nie udało się", "Something Went Wrong");
}
