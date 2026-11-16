import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import ComposeSheet, { ComposeField } from "../src/components/ComposeSheet";
import { api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { EmptyState } from "../src/components/ui";

export default function Report() {
  const { id, question } = useLocalSearchParams<{
    id?: string;
    question?: string;
  }>();
  const { user } = useSession();
  const { t } = useLocale();
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof question !== "string" ||
    !question.trim()
  )
    return (
      <EmptyState
        symbol="books.vertical"
        ionicon="library-outline"
        title={t("Wybierz quiz", "Choose a Quiz")}
        description={t(
          "Otwórz quiz i użyj opcji „Zgłoś problem” przy pytaniu, które chcesz zgłosić.",
          "Open a quiz and use Report Question on the question you want to report.",
        )}
        actions={[
          {
            label: t("Przeglądaj bibliotekę", "Browse Library"),
            onPress: () => router.dismissTo("/library"),
          },
        ]}
      />
    );
  return (
    <ReportForm
      key={`${user?.id}:${id}:${question}`}
      id={id}
      question={question}
    />
  );
}
function ReportForm({ id, question }: { id: string; question: string }) {
  const [client] = useState(() => api.forSession());
  const { t } = useLocale();
  const [text, setText] = useState("");
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
        await client.post("report-question-issue/", {
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
