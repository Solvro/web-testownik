"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  HomeIcon,
  LibraryIcon,
  LockIcon,
  LogInIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { getQuizService } from "@/services";
import { ACCOUNT_TYPE } from "@/types/user";

export default function QuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { isAuthenticated, user } = useContext(AppContext);
  const isGuest = user?.account_type === ACCOUNT_TYPE.GUEST;
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pathParts = pathname.split("/").filter(Boolean);
  const quizId = pathParts[0] === "quiz" ? pathParts[1] : undefined;
  const canRestoreDeletedQuiz =
    isAuthenticated &&
    !isGuest &&
    quizId !== undefined &&
    error.message.includes("restore");

  const { mutate: restoreQuiz, isPending: isRestoring } = useMutation({
    mutationFn: async () => {
      if (quizId === undefined) {
        throw new Error("Nieprawidłowy identyfikator quizu.");
      }
      await getQuizService().restoreQuiz(quizId);
    },
    onSuccess: async () => {
      if (quizId !== undefined) {
        await queryClient.refetchQueries({
          queryKey: quizDetailQueryKey(quizId),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["user-quizzes"] });
      toast.success("Quiz został przywrócony.");
      reset();
    },
    onError: (restoreError) => {
      toast.error("Nie udało się przywrócić quizu.", {
        description:
          restoreError instanceof Error ? restoreError.message : undefined,
      });
    },
  });

  if (error.message.includes("deleted")) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trash2Icon className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Quiz został usunięty</EmptyTitle>
          <EmptyDescription>
            Ten quiz został przeniesiony do kosza i nie jest już dostępny.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex justify-center gap-2">
            {isAuthenticated && !isGuest ? (
              <ButtonLink href="/quizzes" variant="outline">
                <LibraryIcon />
                Moje quizy
              </ButtonLink>
            ) : null}
            {canRestoreDeletedQuiz ? (
              <Button
                onClick={() => {
                  restoreQuiz();
                }}
                disabled={isRestoring}
              >
                {isRestoring ? <Spinner /> : <RotateCcwIcon />}
                Przywróć quiz
              </Button>
            ) : null}
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  if (error.message.includes("403") || error.message.includes("401")) {
    const is401 = error.message.includes("401");
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>
            {is401 ? "Wymagane logowanie" : "Brak dostępu"}
          </EmptyTitle>
          <EmptyDescription>
            {isGuest
              ? "Ten quiz nie jest dostępny dla gości, zaloguj się aby spróbować ponownie, lub skontaktuj się z twórcą quizu aby udostępnił go dla niezalogowanych użytkowników."
              : is401
                ? "Ten quiz jest dostępny tylko dla zalogowanych użytkowników."
                : "Nie masz dostępu do tego quizu. Skontaktuj się z jego twórcą aby ustawić dostępność."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/">
                  <HomeIcon />
                  Strona główna
                </Link>
              )}
            ></Button>
            {!isAuthenticated || isGuest ? (
              <Button
                nativeButton={false}
                render={(props) => (
                  <Link
                    {...props}
                    href={`/login?redirect=${encodeURIComponent(pathname)}`}
                  >
                    <LogInIcon />
                    Zaloguj się
                  </Link>
                )}
              ></Button>
            ) : null}
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>Błąd podczas ładowania quizu</EmptyTitle>
        <EmptyDescription>
          Nie udało się załadować quizu. Może nie istnieć lub wystąpił problem z
          połączeniem.
        </EmptyDescription>
        {isAuthenticated && !isGuest ? (
          <EmptyDescription>
            Upewnij się, że quiz istnieje i masz do niego dostęp.
          </EmptyDescription>
        ) : (
          <EmptyDescription>
            Upewnij się, że quiz istnieje i został udostępniony także dla osób
            bez konta.
          </EmptyDescription>
        )}
      </EmptyHeader>
      <EmptyContent>
        <Accordion className="w-full">
          <AccordionItem value="error-details" className="border-none">
            <AccordionTrigger className="justify-center gap-2 py-2 hover:no-underline">
              Szczegóły błędu
            </AccordionTrigger>
            <AccordionContent className="bg-muted rounded-md p-4 text-left">
              <pre className="overflow-auto text-xs wrap-break-word whitespace-pre-wrap">
                {error.message}
              </pre>
              {error.digest != null && error.digest !== "" ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Digest: {error.digest}
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} variant="default">
            <RefreshCwIcon />
            Spróbuj ponownie
          </Button>
          {isAuthenticated && !isGuest ? (
            <Button
              nativeButton={false}
              variant="outline"
              render={(props) => (
                <Link {...props} href="/">
                  <HomeIcon />
                  Strona główna
                </Link>
              )}
            ></Button>
          ) : (
            <Button
              nativeButton={false}
              variant="outline"
              render={(props) => (
                <Link
                  {...props}
                  href={`/login?redirect=${encodeURIComponent(pathname)}`}
                >
                  <LogInIcon />
                  Zaloguj się
                </Link>
              )}
            ></Button>
          )}
        </div>
        <EmptyDescription>
          Jeśli problem się powtarza, możesz utworzyć zgłoszenie na{" "}
          <a
            href="https://github.com/solvro/web-testownik/issues"
            target="_blank"
            rel="noreferrer"
          >
            GitHubie
          </a>
          .
        </EmptyDescription>
      </EmptyContent>
    </Empty>
  );
}
