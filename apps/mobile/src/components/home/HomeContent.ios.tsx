import {
  Button,
  ContentUnavailableView,
  ContextMenu,
  Gauge,
  Host,
  HStack,
  Image,
  Label,
  List,
  Section,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  accessibilityValue,
  font,
  frame,
  gaugeStyle,
  lineLimit,
  listStyle,
  padding,
  redacted,
  refreshable,
  scaleEffect,
  tint,
  listRowBackground,
} from "@expo/ui/swift-ui/modifiers";
import { useWindowDimensions } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";
import QuizRow, {
  fill,
  Chevron,
  QuizMenu,
  rowLabel,
  secondary,
} from "../quiz-list/QuizRow";
import type { HomeContentProps } from "./types";

export default function HomeContent(props: HomeContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const { fontScale } = useWindowDimensions();
  const continueQuiz = props.continueQuiz;
  const progress = continueQuiz?.progress;

  return (
    <Host style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle("insetGrouped"),
          refreshable(async () => {
            await props.refresh();
          }),
        ]}
      >
        {props.sync.offline || props.sync.pending || props.sync.error ? (
          <Section
            footer={
              props.sync.error ? (
                <Text>{userError(props.sync.error, t)}</Text>
              ) : undefined
            }
          >
            <Label
              title={
                props.sync.offline
                  ? t(
                      "Jesteś offline. Odpowiedzi zapisujemy na urządzeniu.",
                      "You’re offline. Answers are saved on this device.",
                    )
                  : t(
                      `Odpowiedzi czekające na synchronizację: ${props.sync.pending}`,
                      `Answers waiting to sync: ${props.sync.pending}`,
                    )
              }
              systemImage={
                props.sync.offline
                  ? "wifi.slash"
                  : "arrow.triangle.2.circlepath"
              }
            />
            {props.sync.offline ? null : (
              <Button
                label={t("Synchronizuj teraz", "Sync Now")}
                onPress={props.sync.run}
              />
            )}
          </Section>
        ) : null}

        {continueQuiz ? (
          <Section title={t("Kontynuuj", "Continue")}>
            <ContextMenu>
              <ContextMenu.Trigger>
                <Button
                  onPress={() => props.open(continueQuiz.id)}
                  modifiers={[
                    rowLabel,
                    accessibilityLabel(
                      `${t("Kontynuuj", "Continue")}: ${continueQuiz.title}`,
                    ),
                    accessibilityValue(continueQuiz.detail),
                  ]}
                >
                  <HStack spacing={14} modifiers={[padding({ vertical: 8 })]}>
                    <ZStack modifiers={[frame({ width: 52, height: 52 })]}>
                      {progress ? (
                        <Gauge
                          value={
                            progress.mastered / Math.max(progress.total, 1)
                          }
                          modifiers={[
                            gaugeStyle("circularCapacity"),
                            tint(c.primary),
                            scaleEffect(0.9),
                          ]}
                        />
                      ) : null}
                      <Image
                        systemName={progress ? "play.fill" : "play.circle.fill"}
                        size={progress ? 18 : 44}
                        color={c.primary}
                      />
                    </ZStack>
                    <VStack alignment="leading" spacing={3} modifiers={[fill]}>
                      <Text
                        modifiers={[
                          font({ textStyle: "headline" }),
                          ...(fontScale > 1.3 ? [] : [lineLimit(2)]),
                        ]}
                      >
                        {continueQuiz.title}
                      </Text>
                      <Text
                        modifiers={[
                          font({ textStyle: "subheadline" }),
                          secondary,
                        ]}
                      >
                        {continueQuiz.detail}
                      </Text>
                    </VStack>
                    <Chevron />
                  </HStack>
                </Button>
              </ContextMenu.Trigger>
              <QuizMenu quiz={continueQuiz} actions={props} />
            </ContextMenu>
          </Section>
        ) : null}

        {props.loading && !continueQuiz ? (
          <Section title={t("Ostatnio otwierane", "Recently Opened")}>
            {[0, 1, 2, 3].map((i) => (
              <Label
                key={i}
                title={
                  i % 2
                    ? "Quiz title placeholder"
                    : "Longer quiz title placeholder"
                }
                systemImage="doc.text"
                modifiers={[redacted("placeholder")]}
              />
            ))}
          </Section>
        ) : null}

        {props.recent.length ? (
          <Section title={t("Ostatnio otwierane", "Recently Opened")}>
            {props.recent.map((quiz) => (
              <QuizRow key={quiz.id} quiz={quiz} actions={props} />
            ))}
          </Section>
        ) : null}

        {props.error ? (
          <Section>
            <Label
              title={userError(props.error, t)}
              systemImage="exclamationmark.triangle"
            />
            <Button
              label={t("Spróbuj ponownie", "Try Again")}
              onPress={props.retry}
            />
          </Section>
        ) : null}

        {!props.loading && !props.error && !continueQuiz ? (
          <>
            <Section>
              <ContentUnavailableView
                modifiers={[listRowBackground("transparent")]}
                title={t("Nie masz jeszcze quizów", "No Quizzes Yet")}
                systemImage="rectangle.stack.badge.plus"
                description={t(
                  "Utwórz quiz albo zaimportuj pytania, z których chcesz się uczyć.",
                  "Create a quiz or import the questions you want to study.",
                )}
              />
            </Section>
            <Section>
              <Button
                label={t("Nowy quiz", "New Quiz")}
                systemImage="plus"
                onPress={props.createQuiz}
              />
              <Button
                label={t("Importuj quiz", "Import Quiz")}
                systemImage="square.and.arrow.down"
                onPress={props.importQuiz}
              />
              <Button
                label={t("Przeglądaj bibliotekę", "Browse Library")}
                systemImage="books.vertical"
                onPress={props.openLibrary}
              />
            </Section>
          </>
        ) : null}

        {props.savedCount ? (
          <Section title={t("Na tym urządzeniu", "On This Device")}>
            <Button onPress={props.openSaved} modifiers={[rowLabel]}>
              <HStack spacing={14}>
                <Image
                  systemName="arrow.down.circle"
                  size={20}
                  modifiers={[frame({ width: 28 }), secondary]}
                />
                <Text>{t("Zapisane offline", "Saved Offline")}</Text>
                <Spacer />
                <Text modifiers={[secondary]}>{String(props.savedCount)}</Text>
                <Chevron />
              </HStack>
            </Button>
          </Section>
        ) : null}
      </List>
    </Host>
  );
}
