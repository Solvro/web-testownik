import { AlertCircleIcon } from "lucide-react";
import { useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { Loader } from "@/components/loader.tsx";
import { PrivacyDialog } from "@/components/privacy-dialog.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label.tsx";
import { SERVER_URL } from "@/config.ts";
import type { Quiz, QuizProgress } from "@/types/quiz.ts";
import type { UserSettings } from "@/types/user.ts";

export function ConnectGuestAccount() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParameters = new URLSearchParams(location.search);
  const error = queryParameters.get("error");

  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const [migrating, setMigrating] = useState(false);
  const [migratingText, setMigratingText] = useState("");
  const [migrated, setMigrated] = useState(
    localStorage.getItem("guest_migrated") === "true",
  );

  // Category migration checkboxes:
  // – By default, "Quizy" and "Postępy quizów" are enabled, "Ustawienia" is off.
  // – The "Postępy quizów" checkbox is disabled if "Quizy" is off.
  const [categories, setCategories] = useState({
    quizzes: true,
    progress: true,
    settings: false,
  });

  // Guest quizzes state
  const guestQuizzes: Quiz[] = (() => {
    const quizzesString = localStorage.getItem("guest_quizzes");
    if (quizzesString !== null) {
      try {
        return JSON.parse(quizzesString) as Quiz[];
      } catch (error_) {
        console.error("Error parsing guest_quizzes", error_);
        return [];
      }
    }
    return [];
  })();

  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>(() => {
    const quizzesString = localStorage.getItem("guest_quizzes");
    if (quizzesString !== null) {
      try {
        const quizzes = JSON.parse(quizzesString) as Quiz[];
        return quizzes.map((quiz) => quiz.id);
      } catch (error_) {
        console.error("Error parsing guest_quizzes", error_);
        return [];
      }
    }
    return [];
  });

  const handleLogout = async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("access_token_expires_at");
    appContext.services.user.clearStoredUserData();
    appContext.setAuthenticated(false);
    await navigate("/");
  };

  const uploadQuizzes = async (quizIds?: string[]) => {
    for (const quiz of guestQuizzes) {
      if (
        quizIds == null ||
        quizIds.length === 0 ||
        quizIds.includes(quiz.id)
      ) {
        try {
          setMigratingText(`Przenoszenie quizu ${quiz.title}...`);
          const newQuiz = await appContext.services.quiz.createQuiz(quiz);
          const newQuizId = newQuiz.id;
          if (categories.progress) {
            const progressString = localStorage.getItem(`${quiz.id}_progress`);
            if (progressString === null) {
              continue;
            }
            const progress = JSON.parse(progressString) as QuizProgress;
            if (Object.keys(progress).length > 0) {
              setMigratingText(`Przenoszenie postępów quizu ${quiz.title}...`);
              await appContext.services.quiz.setQuizProgress(
                newQuizId,
                progress,
              );
            }
          }
          // Replace the quiz ID in the local storage with the new ID
          localStorage.removeItem(`${quiz.id}_progress`);
          localStorage.setItem(`${newQuizId}_progress`, "{}");
        } catch (error_) {
          console.error("Error uploading quiz", quiz.id, error_);
          throw error_;
        }
      }
    }
  };

  const uploadSettings = async () => {
    setMigratingText("Przenoszenie ustawień...");
    const settingsString = localStorage.getItem("settings");
    const settings: UserSettings =
      settingsString === null
        ? {
            sync_progress: true,
            initial_reoccurrences: 0,
            wrong_answer_reoccurrences: 0,
          }
        : (JSON.parse(settingsString) as UserSettings);
    try {
      await appContext.services.user.updateUserSettings({
        sync_progress: settings.sync_progress,
        initial_reoccurrences: settings.initial_reoccurrences,
        wrong_answer_reoccurrences: settings.wrong_answer_reoccurrences,
      });
    } catch (error_) {
      console.error("Error uploading settings", error_);
      throw error_;
    }
  };

  // Start migration after explicit confirmation
  const executeMigration = async () => {
    setMigrating(true);
    appContext.setGuest(false);
    try {
      if (categories.quizzes && selectedQuizIds.length > 0) {
        await uploadQuizzes(selectedQuizIds);
      }
      if (categories.settings) {
        await uploadSettings();
      }
      setMigrated(true);
      localStorage.setItem("guest_migrated", "true");
    } catch (error_) {
      console.error("Error migrating data", error_);
      toast.error(
        "Wystąpił błąd podczas przenoszenia danych. Spróbuj ponownie później.",
      );
    } finally {
      setMigrating(false);
    }
  };

  // Handler for category checkbox changes. When unchecking "Quizy", also disable "Postępy quizów"
  const handleCategoryToggle = (field: "quizzes" | "progress" | "settings") => {
    setCategories((previous) => {
      const newValue = !previous[field];
      if (field === "quizzes" && !newValue) {
        // If quizzes is turned off, force progress off as well
        return { ...previous, quizzes: false, progress: false };
      }
      return { ...previous, [field]: newValue };
    });
  };

  // Handler for toggling individual quiz selection.
  const handleQuizToggle = (quizId: string) => {
    setSelectedQuizIds((previous) =>
      previous.includes(quizId)
        ? previous.filter((id) => id !== quizId)
        : [...previous, quizId],
    );
  };

  if (migrated) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Dane przeniesione pomyślnie!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              Twoje dane zostały przeniesione pomyślnie. Teraz możesz korzystać
              z pełni funkcji Testownika jako zalogowany użytkownik.
            </p>
            <p>
              Zdecyduj czy dane z konta gościa mają zostać usunięte. Wszystkie
              wybrane quizy oraz postępy zostały już przeniesione na Twoje
              konto.
            </p>
            <p>
              Jeśli zdecydujesz się na pozostawienie danych z konta gościa,
              będziesz miał(a) do nich dostęp w przyszłości po przelogowaniu się
              na konto gościa.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={async () => {
                  localStorage.removeItem("guest_quizzes");
                  localStorage.removeItem("guest_migrated");
                  await navigate("/");
                }}
              >
                Usuń dane gościa
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await navigate("/");
                }}
              >
                Pozostaw
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (migrating) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Przenoszenie danych...</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Loader size={15} />
            <p className="text-muted-foreground text-sm">{migratingText}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      {appContext.isAuthenticated && appContext.isGuest ? (
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Zalogowano pomyślnie!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="mb-8 space-y-3">
              <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Kategorie do migracji
              </h5>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="quizzes"
                    checked={categories.quizzes}
                    onCheckedChange={() => {
                      handleCategoryToggle("quizzes");
                    }}
                  />
                  <Label htmlFor="quizzes">Quizy</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="progress"
                    checked={categories.progress}
                    disabled={!categories.quizzes}
                    onCheckedChange={() => {
                      handleCategoryToggle("progress");
                    }}
                  />
                  <Label htmlFor="progress">Postępy quizów</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="settings"
                    checked={categories.settings}
                    onCheckedChange={() => {
                      handleCategoryToggle("settings");
                    }}
                  />
                  <Label htmlFor="settings">Ustawienia</Label>
                </div>
              </div>
            </section>
            {categories.quizzes ? (
              <section className="space-y-3">
                <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  Wybierz quizy do migracji
                </h5>
                {categories.progress ? (
                  <p className="text-muted-foreground text-xs">
                    (Postępy zostaną przeniesione automatycznie)
                  </p>
                ) : null}
                {guestQuizzes.length > 0 ? (
                  <div className="grid gap-1">
                    {guestQuizzes.map((quiz: Quiz) => (
                      <div className="flex items-center gap-3" key={quiz.id}>
                        <Checkbox
                          key={quiz.id}
                          id={`quiz-${quiz.id}`}
                          checked={selectedQuizIds.includes(quiz.id)}
                          onCheckedChange={() => {
                            handleQuizToggle(quiz.id);
                          }}
                        />
                        <Label htmlFor={`quiz-${quiz.id}`}>{quiz.title}</Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Brak quizów do migracji.
                  </p>
                )}
              </section>
            ) : null}
            <div className="flex flex-wrap justify-center gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    disabled={
                      categories.quizzes && selectedQuizIds.length === 0
                        ? guestQuizzes.length > 0
                        : false
                    }
                  >
                    Rozpocznij migrację
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Potwierdź migrację danych</DialogTitle>
                    <DialogDescription>
                      Czy na pewno chcesz przenieść swoje dane? Tej operacji nie
                      można cofnąć.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="text-muted-foreground text-sm">
                    Wybrane kategorie:{" "}
                    {[
                      categories.quizzes && "Quizy",
                      categories.progress && categories.quizzes && "Postępy",
                      categories.settings && "Ustawienia",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Brak"}
                    .
                  </p>
                  {categories.quizzes ? (
                    <p className="text-muted-foreground text-xs">
                      Quizy do migracji: {selectedQuizIds.length} /{" "}
                      {guestQuizzes.length}
                    </p>
                  ) : null}
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Anuluj</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={executeMigration} disabled={migrating}>
                        Potwierdź
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={handleLogout}>
                Wyloguj
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : appContext.isGuest ? (
        <Card className="w-full max-w-3xl pb-2">
          <CardHeader>
            <CardTitle>Połącz konto</CardTitle>
            <CardDescription>
              Obecnie korzystasz z Testownika jako gość. Aby móc korzystać z
              pełni funkcji Testownika, możesz przejść na konto online. W ten
              sposób będziesz mógł synchronizować swoje quizy oraz wyniki,
              udostępniać quizy oraz przeglądać swoje oceny. Po zalogowaniu za
              pomocą USOS będziesz mógł również przenieść swoje quizy oraz
              wyniki z konta gościa. Jeśli nie chcesz logować się za pomocą
              USOS, możesz kontynuować jako gość.
            </CardDescription>
          </CardHeader>
          {error == null ? null : (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Wystąpił błąd podczas logowania.</AlertTitle>
              {error === "not_student" ? (
                <AlertDescription>
                  Niestety, nie udało nam się zidentyfikować Cię jako studenta
                  PWr. Upewnij się, że logujesz się na swoje konto studenta.
                  Jeśli problem będzie się powtarzał,{" "}
                  <a href="mailto:testownik@solvro.pl">skontaktuj się z nami</a>
                  .
                </AlertDescription>
              ) : (
                <AlertDescription>{error}</AlertDescription>
              )}
            </Alert>
          )}
          <CardContent className="text-sm">
            <div className="grid gap-2">
              <Button asChild>
                <a
                  href={`${SERVER_URL}/login/usos?jwt=true&redirect=${document.location.href}`}
                >
                  Zaloguj się z USOS
                </a>
              </Button>
              <Button asChild>
                <a
                  href={`${SERVER_URL}/login?jwt=true&redirect=${document.location.href}`}
                >
                  Zaloguj się z Solvro Auth
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Anuluj i kontynuuj jako gość</Link>
              </Button>
            </div>
            <div className="text-center">
              <Button
                variant="link"
                className="text-muted-foreground text-xs hover:underline"
                onClick={() => {
                  setShowPrivacyDialog(true);
                }}
              >
                Jak wykorzystujemy Twoje dane?
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Błąd autoryzacji</AlertTitle>
          <AlertDescription>
            Migracja danych jest dostępna tylko dla użytkowników zalogowanych
            jako gość.
            <div className="mt-2">
              <Button variant="outline" asChild>
                <Link to="/">Strona główna</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <PrivacyDialog
        open={showPrivacyDialog}
        onOpenChange={(open) => {
          setShowPrivacyDialog(open);
        }}
      />
    </div>
  );
}
