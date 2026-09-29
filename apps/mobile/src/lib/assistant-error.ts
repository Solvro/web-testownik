import { userError } from "./user-error";
import { ApiError } from "./client";

type Translate = (polish: string, english: string) => string;
export function assistantError(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.status === 503)
      return t(
        "Asystent jest chwilowo niedostępny. Spróbuj ponownie później.",
        "The assistant is temporarily unavailable. Try again later.",
      );
    if (error.status === 429)
      return t(
        "Odczekaj chwilę przed kolejną wiadomością.",
        "Wait a moment before sending another message.",
      );
    if (error.status === 403)
      return t(
        "To konto nie ma dostępu do asystenta.",
        "This account does not have access to the assistant.",
      );
    if (error.status === 401)
      return t(
        "Zaloguj się ponownie, aby skorzystać z asystenta.",
        "Sign in again to use the assistant.",
      );
  }
  return error instanceof Error
    ? userError(error, t)
    : t(
        "Nie udało się otrzymać odpowiedzi. Spróbuj ponownie.",
        "Could not get a response. Please try again.",
      );
}
