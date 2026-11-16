import { Linking } from "react-native";
import { notify } from "./alerts";
import type { Translate } from "./user-error";

export async function openRichTextLink(url: string, t: Translate) {
  if (!/^https?:\/\//i.test(url)) return;
  try {
    await Linking.openURL(url);
  } catch {
    notify(
      t("Nie udało się otworzyć linku", "Couldn’t Open Link"),
      t("Spróbuj ponownie za chwilę.", "Please try again in a moment."),
    );
  }
}

export function allowRichTextNavigation(url: string, t: Translate) {
  if (url === "about:blank") return true;
  void openRichTextLink(url, t);
  return false;
}
