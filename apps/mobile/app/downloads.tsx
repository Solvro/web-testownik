import { useQuery } from "@tanstack/react-query";
import { Stack, router, useFocusEffect } from "expo-router";
import { Platform } from "react-native";
import { useCallback, useMemo } from "react";
import { storedValueBytes } from "../src/lib/android-chunk-storage";
import { formatQuizStorageSize } from "../src/lib/quiz-storage-issue";
import { CollectionSkeleton } from "../src/components/Collection";
import SavedList from "../src/components/downloads/SavedList";
import {
  EmptyState,
  ErrorScreen,
  Screen,
  notify,
  useConfirm,
} from "../src/components/ui";
import { haptics } from "../src/lib/haptics";
import { removeQuizImages } from "../src/lib/offline-images";
import { userError } from "../src/lib/user-error";
import { useSession } from "../src/lib/session";
import { useLocale } from "../src/lib/locale";
import { questionCount } from "../src/lib/collection-copy";
export default function Downloads() {
  const s = useSession(),
    { t, language } = useLocale(),
    confirm = useConfirm();
  const query = useQuery({
    queryKey: ["offline", s.user?.id],
    queryFn: () => s.library!.read(),
    enabled: !!s.library,
    networkMode: "always",
  });
  const readSaved = query.refetch;
  useFocusEffect(
    useCallback(() => {
      if (s.library) void readSaved();
    }, [s.library, readSaved]),
  );
  const quizzes = Object.values(query.data?.quizzes ?? {});
  const sizes = useMemo(() => {
    if (Platform.OS !== "android" || !query.data) return null;
    return {
      total: storedValueBytes(query.data),
      quizzes: new Map(
        Object.values(query.data.quizzes).map((quiz) => [
          quiz.id,
          storedValueBytes(quiz),
        ]),
      ),
    };
  }, [query.data]);
  const title = (
    <Stack.Screen options={{ title: t("Zapisane offline", "Saved Offline") }} />
  );
  if (query.isSuccess && !quizzes.length)
    return (
      <>
        {title}
        <EmptyState
          symbol="arrow.down.circle"
          ionicon="download-outline"
          title={t("Brak zapisanych quizów", "No Saved Quizzes")}
          description={t(
            "Quizy, które otworzysz, zapisują się na tym urządzeniu, więc możesz się z nich uczyć bez internetu.",
            "Quizzes you open are saved on this device so you can study them without internet.",
          )}
          actions={[
            {
              label: t("Przeglądaj bibliotekę", "Browse Library"),
              onPress: () => router.navigate("/library"),
            },
          ]}
        />
      </>
    );
  if (query.isPending)
    return (
      <Screen>
        {title}
        <CollectionSkeleton
          label={t("Wczytywanie quizów", "Loading quizzes")}
        />
      </Screen>
    );
  if (query.error)
    return (
      <>
        {title}
        <ErrorScreen error={query.error} retry={() => void query.refetch()} />
      </>
    );
  // Unsynced answers would be lost, so only then does removing ask first.
  const remove = async (quizId: string) => {
    try {
      // Downloads can remain mounted while a quiz gains offline answers.
      const state = await s.library!.read();
      const quiz = state.quizzes[quizId];
      const drop = async (discardPending = false) => {
        if (discardPending) {
          await s.library!.discard(quizId);
          // Reconcile the local queue count before any background network work.
          void s.sync();
        }
        // Atomic guard also protects an answer enqueued after the read above.
        else await s.library!.remove(quizId);
        if (quiz) await removeQuizImages(quiz);
        haptics.success();
        await query.refetch();
      };
      if (state.queue.some((item) => item.quiz_id === quizId))
        confirm(
          t("Usunąć z urządzenia?", "Remove from This Device?"),
          t(
            "Niezsynchronizowane odpowiedzi zostaną utracone.",
            "Unsynced answers will be lost.",
          ),
          () => drop(true),
          { action: t("Usuń", "Remove") },
        );
      else await drop();
    } catch (error) {
      notify(
        t("Nie udało się usunąć", "Couldn’t Remove Quiz"),
        userError(error, t),
      );
    }
  };
  return (
    <SavedList
      title={title}
      help={[
        t(
          "Pytania, obrazy i postępy są zapisane na tym urządzeniu, więc możesz się uczyć bez internetu. Funkcje AI wymagają połączenia.",
          "Questions, images and progress are saved on this device, so you can study without internet. AI features need a connection.",
        ),
        sizes
          ? t(
              `Dane zapisanych quizów: około ${formatQuizStorageSize(sizes.total, language)} z limitu 8 MB dla tego konta.`,
              `Saved quiz data: about ${formatQuizStorageSize(sizes.total, language)} of this account’s 8 MB limit.`,
            )
          : null,
        Platform.OS === "ios"
          ? t(
              "Przesuń quiz w lewo, aby usunąć go z urządzenia.",
              "Swipe a quiz to remove it from this device.",
            )
          : t(
              "Użyj przycisku kosza, aby usunąć quiz z urządzenia.",
              "Use the trash button to remove a quiz from this device.",
            ),
      ]
        .filter(Boolean)
        .join(" ")}
      items={quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        detail:
          [
            questionCount(quiz.questions.length, language),
            sizes
              ? `~${formatQuizStorageSize(sizes.quizzes.get(quiz.id) ?? 0, language)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      }))}
      open={(id) => router.push({ pathname: "/quiz/[id]", params: { id } })}
      remove={remove}
    />
  );
}
