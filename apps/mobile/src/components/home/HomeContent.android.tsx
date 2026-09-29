import {
  Button as ComposeButton,
  Card,
  Column,
  LinearWavyProgressIndicator,
  Row as ComposeRow,
  Text as ComposeText,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  paddingAll,
} from "@expo/ui/jetpack-compose/modifiers";
import { Fragment } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { useLocale } from "../../lib/locale";
import { usePullRefresh } from "../../lib/use-pull-refresh";
import { useTheme } from "../../lib/theme";
import {
  Collection,
  CollectionDivider,
  CollectionHeading,
  CollectionSkeleton,
} from "../Collection";
import SyncStatus from "../SyncStatus";
import CollectionRow from "../native/CollectionRow";
import { ListEmpty, ListError } from "../native/ListStatus.android";
import { ErrorState } from "../ui";
import type { HomeContentProps } from "./types";
import M3Host from "../native/M3Host";

// Android: Material 3. The quiz to continue is a filled card with a wavy
// progress indicator and a filled button; the rest are grouped list segments.
export default function HomeContent(props: HomeContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const first = props.continueQuiz;
  const pull = usePullRefresh(props.refresh);
  const hasContent = !!first || props.recent.length > 0 || props.savedCount > 0;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 32,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          {...pull}
          colors={[c.primary]}
          progressBackgroundColor={c.surface}
        />
      }
    >
      <SyncStatus />
      {props.error && hasContent ? (
        <View style={{ paddingTop: 8 }}>
          <ErrorState error={props.error} retry={props.retry} />
        </View>
      ) : null}
      {first ? (
        <>
          <CollectionHeading>{t("Kontynuuj", "Continue")}</CollectionHeading>
          <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Card
              colors={{ containerColor: c.tint }}
              modifiers={[
                fillMaxWidth(),
                clickable(() => props.open(first.id)),
              ]}
            >
              <Column
                verticalArrangement={{ spacedBy: 12 }}
                modifiers={[fillMaxWidth(), paddingAll(20)]}
              >
                <ComposeText
                  maxLines={3}
                  overflow="ellipsis"
                  style={{ typography: "titleLarge" }}
                >
                  {first.title}
                </ComposeText>
                {first.progress ? (
                  <LinearWavyProgressIndicator
                    progress={
                      first.progress.total
                        ? first.progress.mastered / first.progress.total
                        : 0
                    }
                    modifiers={[fillMaxWidth()]}
                  />
                ) : null}
                <ComposeText style={{ typography: "bodyMedium" }}>
                  {first.detail}
                </ComposeText>
                <ComposeRow horizontalArrangement={{ spacedBy: 8 }}>
                  <ComposeButton onClick={() => props.open(first.id)}>
                    <ComposeText>{t("Kontynuuj", "Continue")}</ComposeText>
                  </ComposeButton>
                  {first.canEdit ? (
                    <TextButton onClick={() => props.edit(first.id)}>
                      <ComposeText>{t("Edytuj", "Edit")}</ComposeText>
                    </TextButton>
                  ) : null}
                </ComposeRow>
              </Column>
            </Card>
          </M3Host>
        </>
      ) : props.loading ? (
        <View style={{ paddingTop: 24 }}>
          <CollectionSkeleton
            label={t("Wczytywanie quizów", "Loading quizzes")}
          />
        </View>
      ) : hasContent ? null : props.error ? (
        <ListError error={props.error} retry={props.retry} />
      ) : (
        <ListEmpty
          ionicon="library-outline"
          title={t("Nie masz jeszcze quizów", "No Quizzes Yet")}
          description={t(
            "Utwórz quiz albo zaimportuj pytania, z których chcesz się uczyć.",
            "Create a quiz or import the questions you want to study.",
          )}
          actions={[
            {
              label: t("Nowy quiz", "New Quiz"),
              onPress: props.createQuiz,
              primary: true,
            },
            {
              label: t("Importuj quiz", "Import Quiz"),
              onPress: props.importQuiz,
            },
            {
              label: t("Przeglądaj bibliotekę", "Browse Library"),
              onPress: props.openLibrary,
            },
          ]}
        />
      )}
      {props.recent.length ? (
        <>
          <CollectionHeading>
            {t("Ostatnio otwierane", "Recently Opened")}
          </CollectionHeading>
          <Collection>
            {props.recent.map((q, index) => (
              <Fragment key={q.id}>
                {index ? <CollectionDivider /> : null}
                <CollectionRow
                  title={q.title}
                  detail={q.detail}
                  onPress={() => props.open(q.id)}
                />
              </Fragment>
            ))}
          </Collection>
        </>
      ) : null}
      {props.savedCount ? (
        <>
          <CollectionHeading>
            {t("Na tym urządzeniu", "On This Device")}
          </CollectionHeading>
          <Collection>
            <CollectionRow
              kind="offline"
              title={t("Zapisane offline", "Saved Offline")}
              detail={t(
                `Quizy na tym urządzeniu: ${props.savedCount}`,
                `Quizzes on this device: ${props.savedCount}`,
              )}
              onPress={props.openSaved}
            />
          </Collection>
        </>
      ) : null}
    </ScrollView>
  );
}
