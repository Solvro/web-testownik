import { Fragment } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import {
  Collection,
  CollectionDivider,
  CollectionHeading,
  CollectionSkeleton,
} from "../Collection";
import SyncStatus from "../SyncStatus";
import CollectionRow from "../native/CollectionRow";
import { Button, ErrorState, Label } from "../ui";
import type { HomeContentProps } from "./types";

// Browser preview and Android. iOS renders a native SwiftUI list instead.
export default function HomeContent(props: HomeContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const first = props.continueQuiz;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
      }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => void props.refresh()}
          tintColor={c.primary}
        />
      }
    >
      <SyncStatus />
      {first ? (
        <>
          <CollectionHeading>{t("Kontynuuj", "Continue")}</CollectionHeading>
          <Collection>
            <CollectionRow
              kind="continue"
              title={first.title}
              detail={first.detail}
              accessibilityLabel={`${t("Kontynuuj", "Continue")}: ${first.title}`}
              onPress={() => props.open(first.id)}
            />
          </Collection>
        </>
      ) : props.loading ? (
        <View style={{ paddingTop: 24 }}>
          <CollectionSkeleton
            label={t("Wczytywanie quizów", "Loading quizzes")}
          />
        </View>
      ) : props.error ? null : (
        <View style={{ paddingTop: 32, paddingBottom: 16, gap: 14 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 26, fontWeight: "700", color: c.text }}
          >
            {t("Nie masz jeszcze quizów", "No Quizzes Yet")}
          </Text>
          <Label muted>
            {t(
              "Utwórz quiz albo zaimportuj pytania, z których chcesz się uczyć.",
              "Create a quiz or import the questions you want to study.",
            )}
          </Label>
          <Button onPress={props.createQuiz}>
            {t("Nowy quiz", "New Quiz")}
          </Button>
          <Button kind="secondary" onPress={props.importQuiz}>
            {t("Importuj quiz", "Import Quiz")}
          </Button>
          <Button kind="secondary" onPress={props.openLibrary}>
            {t("Przeglądaj bibliotekę", "Browse Library")}
          </Button>
        </View>
      )}
      {props.error ? (
        <ErrorState error={props.error} retry={props.retry} />
      ) : null}
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
