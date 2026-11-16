import type { QuizMetadata } from "@testownik/core/quiz/types";
import { useQuery } from "@tanstack/react-query";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";
import { Image, Platform, View, useColorScheme } from "react-native";

import { headerMenus } from "../../../src/components/header-action";
import { NavigationTitleImage } from "../../../modules/library-drag/src/NavigationTitleImage";
import HomeContent from "../../../src/components/home/HomeContent";
import type { QuizListItem } from "../../../src/components/quiz-list/types";
import { api, listOf } from "../../../src/lib/api";
import { saveQuizImages } from "../../../src/lib/offline-images";
import { openedDate, questionCount } from "../../../src/lib/collection-copy";
import { useLocale } from "../../../src/lib/locale";
import { useSession } from "../../../src/lib/session";
import { studyProgress } from "../../../src/lib/study-summary";
import { useTheme } from "../../../src/lib/theme";

export default function Home() {
  const s = useSession(),
    c = useTheme();
  const { t, language } = useLocale();
  const recent = useQuery({
    queryKey: ["recent", s.user?.id],
    queryFn: async () =>
      listOf(await api.request<QuizMetadata[]>("last-used-quizzes/?limit=8")),
    enabled: !!s.user && !s.offline,
  });
  const saved = useQuery({
    queryKey: ["offline", s.user?.id],
    queryFn: () => s.library!.read(),
    enabled: !!s.library,
    networkMode: "always",
  });
  // Refresh local availability after returning from a quiz without waiting for the network.
  const readSaved = saved.refetch;
  useFocusEffect(
    useCallback(() => {
      if (s.library) void readSaved();
    }, [s.library, readSaved]),
  );
  const offline = Object.values(saved.data?.quizzes ?? {});
  // Quizzes saved before images were stored offline catch up in the background.
  useEffect(() => {
    if (s.offline || !saved.data) return;
    void (async () => {
      for (const quiz of Object.values(saved.data.quizzes))
        await saveQuizImages(quiz);
    })();
  }, [saved.data, s.offline]);
  const available = (recent.data ?? []).filter(
    (q) => !s.offline || saved.data?.quizzes[q.id],
  );
  const toHome = (
    quiz: QuizMetadata | (typeof offline)[number],
  ): QuizListItem => {
    const progress = studyProgress(quiz, saved.data?.quizzes[quiz.id]);
    const count =
      "questions" in quiz ? quiz.questions.length : quiz.question_count;
    return {
      id: quiz.id,
      title: quiz.title,
      progress,
      canEdit: !!quiz.can_edit,
      detail:
        [
          progress
            ? t(
                `Opanowane: ${progress.mastered} z ${progress.total}`,
                `${progress.mastered} of ${progress.total} mastered`,
              )
            : questionCount(count, language),
          "last_used_at" in quiz
            ? openedDate(quiz.last_used_at, language)
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || t("Otwórz quiz", "Open quiz"),
    };
  };
  const first = available[0] ?? offline[0];
  const dark = useColorScheme() === "dark";
  const title = t("Nauka", "Study");
  const nativeBrand =
    Platform.OS === "ios" &&
    Number.parseInt(String(Platform.Version), 10) >= 26;
  // iOS uses a native large title image and an inline title attachment.
  // The screen title stays available to the back menu and accessibility.
  // Web and Android show the logo at the start of the bar.
  const logo = (
    <Image
      accessibilityRole="header"
      accessibilityLabel="Testownik"
      source={
        dark
          ? require("../../../assets/logo-full-dark.png")
          : require("../../../assets/logo-full.png")
      }
      style={{ width: 103, height: 18 }}
      resizeMode="contain"
    />
  );
  const push = (pathname: "/quiz/[id]" | "/editor" | "/share", id: string) =>
    router.push({ pathname, params: { id } });
  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title,
          // Android's toolbar shows the logo on the left instead.
          headerTitle:
            Platform.OS === "android"
              ? () => null
              : Platform.OS === "ios" && !nativeBrand
                ? () => logo
                : undefined,
          headerLargeTitleEnabled: nativeBrand,
          // The native image uses the existing large title line; hide its text.
          headerLargeTitleStyle: nativeBrand
            ? { fontSize: 1, color: "transparent" }
            : undefined,
          headerStyle: { backgroundColor: "transparent" },
          headerLeft: Platform.OS === "web" ? () => logo : undefined,
          ...headerMenus(
            [
              {
                label: t("Dodaj quiz", "Add Quiz"),
                icon: "plus",
                fallbackIcon: "add",
                sections: [
                  [
                    {
                      title: t("Nowy quiz", "New Quiz"),
                      icon: "square.and.pencil",
                      onPress: () => router.push("/editor"),
                    },
                    {
                      title: t("Importuj quiz", "Import Quiz"),
                      icon: "square.and.arrow.down",
                      onPress: () => router.push("/import"),
                    },
                  ],
                ],
              },
            ],
            t,
          ),
        }}
      />
      {Platform.OS === "android" ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.View hidesSharedBackground>{logo}</Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
      <HomeContent
        continueQuiz={first ? toHome(first) : undefined}
        recent={available
          .filter((q) => q.id !== first?.id)
          .slice(0, 6)
          .map(toHome)}
        savedCount={offline.length}
        loading={recent.isLoading || saved.isPending}
        error={saved.error ?? (s.offline ? null : recent.error)}
        sync={{
          offline: s.offline,
          pending: s.pending,
          error: s.syncError,
          run: s.sync,
        }}
        refresh={() => Promise.all([recent.refetch(), saved.refetch()])}
        retry={() => void Promise.all([recent.refetch(), saved.refetch()])}
        open={(id) => push("/quiz/[id]", id)}
        edit={(id) => push("/editor", id)}
        share={(id) => push("/share", id)}
        createQuiz={() => router.push("/editor")}
        importQuiz={() => router.push("/import")}
        openLibrary={() => router.push("/library")}
        openSaved={() => router.push("/downloads")}
      />
      {nativeBrand ? <NavigationTitleImage imageName="brand-logo" /> : null}
    </View>
  );
}
