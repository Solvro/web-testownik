import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import ComposeSheet, { ComposeField } from "../src/components/ComposeSheet";
import { api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";

export default function Feedback() {
  const message = useRef<TextInput>(null);
  const [client] = useState(() => api.forSession());
  const { t } = useLocale();
  const s = useSession(),
    [title, setTitle] = useState(""),
    [content, setContent] = useState("");
  return (
    <ComposeSheet
      title={t("Prześlij opinię", "Send Feedback")}
      action={t("Wyślij", "Send")}
      valid={!!title.trim() && !!content.trim()}
      dirty={!!title.trim() || !!content.trim()}
      footer={t(
        "Czytamy każdą wiadomość. Jeśli trzeba, odpiszemy na adres e-mail Twojego konta.",
        "We read every message and may reply to your account’s email address.",
      )}
      send={async () => {
        await client.post("feedback/send", {
          title: title.trim(),
          content: content.trim(),
          name: s.user?.full_name || t("Użytkownik aplikacji", "App user"),
          email: s.user?.email ?? "",
          reportType: "feedback",
        });
      }}
    >
      <ComposeField
        placeholder={t("Temat", "Subject")}
        accessibilityLabel={t("Temat", "Subject")}
        value={title}
        onChangeText={setTitle}
        autoFocus
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => message.current?.focus()}
      />
      <ComposeField
        ref={message}
        divider
        multiline
        placeholder={t("Co możemy poprawić?", "What could we do better?")}
        accessibilityLabel={t("Wiadomość", "Message")}
        value={content}
        onChangeText={setContent}
      />
    </ComposeSheet>
  );
}
