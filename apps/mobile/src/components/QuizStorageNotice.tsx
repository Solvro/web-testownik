import { View } from "react-native";
import { router } from "expo-router";
import { useLocale } from "../lib/locale";
import {
  quizStorageMessage,
  type QuizStorageIssue,
} from "../lib/quiz-storage-issue";
import { Button, Label } from "./ui";

export default function QuizStorageNotice({
  issue,
  retry,
  disabled,
}: {
  issue: QuizStorageIssue;
  retry?: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <View style={{ gap: 8 }}>
      <Label>{quizStorageMessage(issue, t)}</Label>
      <Button
        kind="secondary"
        onPress={() =>
          issue.fitsAlone === false
            ? router.navigate("/library")
            : router.push("/downloads")
        }
      >
        {issue.fitsAlone === false
          ? t("Przeglądaj bibliotekę", "Browse Library")
          : t("Zarządzaj zapisanymi quizami", "Manage Saved Quizzes")}
      </Button>
      {retry && issue.fitsAlone !== false ? (
        <Button
          kind="secondary"
          disabled={disabled}
          onPress={async () => {
            await retry();
          }}
        >
          {t("Sprawdź aktualizacje", "Retry Updates")}
        </Button>
      ) : null}
    </View>
  );
}
