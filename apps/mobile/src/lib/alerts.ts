import { userError } from "./user-error";
import { useLocale } from "./locale";
import { Alert, Platform } from "react-native";

export function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}
// Confirmed actions still running, by prompt. Asking again while the first
// request is in flight (a second tap on Delete) would repeat the action.
const running = new Set<string>();

export function confirm(
  title: string,
  message: string,
  action: () => void | Promise<void>,
  labels = { cancel: "Anuluj", confirm: "Potwierdź", error: "Błąd" },
  formatError: (error: unknown) => string = String,
  destructive = true,
) {
  const key = `${title}\n${message}`;
  if (running.has(key)) return;
  const run = () => {
    running.add(key);
    void Promise.resolve()
      .then(action)
      .catch((e) => notify(labels.error, formatError(e)))
      .finally(() => running.delete(key));
  };
  if (Platform.OS === "web") {
    if (window.confirm(key)) run();
  } else
    Alert.alert(title, message, [
      { text: labels.cancel, style: "cancel" },
      {
        text: labels.confirm,
        style: destructive ? "destructive" : "default",
        onPress: run,
      },
    ]);
}

/**
 * Asks before an action. Name the button with the action's verb ("Delete",
 * "Start Again"), not "OK" or "Confirm".
 */
export function useConfirm() {
  const { t } = useLocale();
  return (
    title: string,
    message: string,
    action: () => void | Promise<void>,
    options: { action?: string; destructive?: boolean } = {},
  ) =>
    confirm(
      title,
      message,
      action,
      {
        cancel: t("Anuluj", "Cancel"),
        confirm: options.action ?? t("Potwierdź", "Confirm"),
        // "Couldn’t Delete" says what failed; a bare "Error" doesn't.
        error: options.action
          ? t("Nie udało się", `Couldn’t ${options.action}`)
          : t("Nie udało się", "Something Went Wrong"),
      },
      (error) => userError(error, t),
      options.destructive ?? true,
    );
}
