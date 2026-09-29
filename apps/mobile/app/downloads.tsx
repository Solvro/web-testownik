import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
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
  const quizzes = Object.values(query.data?.quizzes ?? {});
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
  const remove = (quizId: string) => {
    const quiz = query.data?.quizzes[quizId];
    const drop = async () => {
      await s.library!.discard(quizId);
      if (quiz) removeQuizImages(quiz);
      haptics.success();
      await query.refetch();
    };
    if (query.data?.queue.some((item) => item.quiz_id === quizId))
      confirm(
        t("Usunąć z urządzenia?", "Remove from This Device?"),
        t(
          "Niezsynchronizowane odpowiedzi zostaną utracone.",
          "Unsynced answers will be lost.",
        ),
        drop,
        { action: t("Usuń", "Remove") },
      );
    else
      void drop().catch((error: unknown) =>
        notify(
          t("Nie udało się usunąć", "Couldn’t Remove Quiz"),
          userError(error, t),
        ),
      );
  };
  return (
    <SavedList
      title={title}
      help={t(
        "Pytania, obrazy i postępy są zapisane na tym urządzeniu, więc możesz się uczyć bez internetu. Funkcje AI wymagają połączenia. Przesuń quiz w lewo, aby usunąć go z urządzenia.",
        "Questions, images and progress are saved on this device, so you can study without internet. AI features need a connection. Swipe a quiz to remove it from this device.",
      )}
      items={quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        detail: questionCount(quiz.questions.length, language) ?? undefined,
      }))}
      open={(id) => router.push({ pathname: "/quiz/[id]", params: { id } })}
      remove={remove}
    />
  );
}
