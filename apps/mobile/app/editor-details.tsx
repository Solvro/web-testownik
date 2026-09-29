import { Stack, router, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";

import Field from "../src/components/editor/EditorField";
import { Button, Label, Screen } from "../src/components/ui";
import { useEditorSession } from "../src/lib/editor-store";
import { useLocale } from "../src/lib/locale";
import { useTheme } from "../src/lib/theme";

/** The quiz's title and description, edited in a sheet over the question list. */
export default function EditorDetails() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const session = useEditorSession(key);
  const { t } = useLocale();
  const c = useTheme();
  if (!session)
    return (
      <Screen>
        <Label>{t("Edytor został zamknięty.", "The editor was closed.")}</Label>
        <Button onPress={() => router.back()}>{t("Wróć", "Go Back")}</Button>
      </Screen>
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          variant="prominent"
          tintColor={c.prominent}
          onPress={() => router.back()}
        >
          {t("Gotowe", "Done")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 4 }}
      >
        <Field
          editable={!session.saving}
          label={t("Tytuł", "Title")}
          autoFocus={!session.draft.title}
          value={session.draft.title}
          onChangeText={(title) => session.update((d) => ({ ...d, title }))}
        />
        <Field
          editable={!session.saving}
          label={t("Opis (opcjonalnie)", "Description (optional)")}
          multiline
          value={session.draft.description}
          onChangeText={(description) =>
            session.update((d) => ({ ...d, description }))
          }
        />
      </ScrollView>
    </View>
  );
}
