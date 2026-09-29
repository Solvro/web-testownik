import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import ComposeSheet, { ComposeField } from "../src/components/ComposeSheet";
import { api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";

export default function Report() {
  const { t } = useLocale();
  const { id, question } = useLocalSearchParams<{
      id: string;
      question: string;
    }>(),
    [text, setText] = useState("");
  return (
    <ComposeSheet
      title={t("Zgłoś problem", "Report Question")}
      action={t("Wyślij", "Send")}
      valid={!!text.trim()}
      dirty={!!text.trim()}
      footer={t(
        "Zgłoszenie trafi do autora quizu.",
        "Your report goes to the quiz author.",
      )}
      send={async () => {
        await api.post("report-question-issue/", {
          quiz_id: id,
          question_id: question,
          issue: text.trim(),
        });
      }}
    >
      <ComposeField
        multiline
        autoFocus
        placeholder={t(
          "Co jest nie tak z tym pytaniem?",
          "What’s wrong with this question?",
        )}
        accessibilityLabel={t("Opis problemu", "Describe the problem")}
        value={text}
        onChangeText={setText}
      />
    </ComposeSheet>
  );
}
