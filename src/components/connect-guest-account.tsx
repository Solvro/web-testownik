"use client";

import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import { PrivacyDialog } from "@/components/privacy-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { API_URL } from "@/lib/api";
import { GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { setCookie } from "@/lib/cookies";
import { createGuestDataBackup } from "@/lib/migration";
import type { Quiz } from "@/types/quiz";
import type { UserSettings } from "@/types/user";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

export function ConnectGuestAccount() {
  const appContext = useContext(AppContext);
  const router = useRouter();
  const searchParameters = useSearchParams();
  const error = searchParameters.get("error");

  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

  const [migrating, setMigrating] = useState(false);
  const [migratingText, setMigratingText] = useState("");
  const [migrated, setMigrated] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [backupData, setBackupData] = useState<string | null>(null);
  const [guestQuizzes, setGuestQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
    setMigrated(localStorage.getItem("guest_migrated") === "true");

    const quizzesString = localStorage.getItem("guest_quizzes");
    if (quizzesString !== null) {
      try {
        const quizzes = JSON.parse(quizzesString) as Quiz[];
        // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
        setGuestQuizzes(quizzes);
        // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
        setSelectedQuizIds(quizzes.map((quiz) => quiz.id));
      } catch (parseError) {
        console.error("Error parsing guest_quizzes", parseError);
      }
    }
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
    setIsDataLoaded(true);
  }, []);

  // Category migration checkboxes:
  // – By default, "Quizy" is enabled, "Ustawienia" is off.
  const [categories, setCategories] = useState({
    quizzes: true,
    settings: false,
  });

  const [redirectUrl, setRedirectUrl] = useState("/");

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
    setRedirectUrl(window.location.href);
  }, []);

  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "POST" });
    setIsDataLoaded(false);
    appContext.setAuthenticated(false);
    setCookie(GUEST_COOKIE_NAME, "true", {
      maxAge: 12 * 30 * 24 * 60 * 60,
    });
    router.push("/");
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
          await appContext.services.quiz.createQuiz(quiz);

          // Remove old progress, new one will be created on the backend
          localStorage.removeItem(`${quiz.id}_progress`);
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
    let settings: UserSettings;
    if (settingsString === null) {
      settings = { ...DEFAULT_USER_SETTINGS };
    } else {
      try {
        const parsed = JSON.parse(settingsString) as Partial<UserSettings>;
        settings = {
          ...DEFAULT_USER_SETTINGS,
          ...parsed,
        };
      } catch {
        settings = { ...DEFAULT_USER_SETTINGS };
      }
    }
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

  const downloadBackup = () => {
    if (backupData === null) {
      return;
    }
    const blob = new Blob([backupData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testownik-backup-${new Date().toISOString()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Start migration after explicit confirmation
  const executeMigration = async () => {
    setMigrating(true);
    setMigrationError(null);
    const backup = createGuestDataBackup();
    setBackupData(backup);

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
      setMigrationError(
        "Wystąpił błąd podczas przenoszenia danych. Zalecamy pobranie kopii zapasowej (backup).",
      );
    } finally {
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    setIsDataLoaded(false);
    router.push("/");
    appContext.setGuest(false);
    localStorage.removeItem("guest_migrated");
  };

  // Handler for category checkbox changes.
  const handleCategoryToggle = (field: "quizzes" | "settings") => {
    setCategories((previous) => {
      const newValue = !previous[field];
      return { ...previous, [field]: newValue };
    });
  };

  const handleQuizToggle = (quizId: string) => {
    setSelectedQuizIds((previous) =>
      previous.includes(quizId)
        ? previous.filter((id) => id !== quizId)
        : [...previous, quizId],
    );
  };

  useEffect(() => {
    if (
      isDataLoaded &&
      appContext.isAuthenticated &&
      appContext.isGuest &&
      guestQuizzes.length === 0
    ) {
      handleSkip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDataLoaded,
    appContext.isAuthenticated,
    appContext.isGuest,
    guestQuizzes.length,
  ]);

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
              wybrane quizy zostały już przeniesione na Twoje konto.
            </p>
            <p>
              Jeśli zdecydujesz się na pozostawienie danych z konta gościa,
              będziesz miał(a) do nich dostęp w przyszłości po przelogowaniu się
              na konto gościa.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  localStorage.removeItem("guest_quizzes");
                  localStorage.removeItem("guest_migrated");
                  router.push("/");
                }}
              >
                Usuń dane gościa
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  router.push("/");
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

  if (migrationError !== null) {
    return (
      <div className="flex justify-center">
        <Card className="border-destructive/50 w-full max-w-3xl">
          <CardHeader>
            <div className="text-destructive flex items-center gap-2">
              <AlertCircleIcon className="size-5" />
              <CardTitle>Błąd migracji</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{migrationError}</p>
            <p className="text-muted-foreground text-sm">
              Twoje dane nie zostały utracone. Możesz pobrać plik z pełną kopią
              zapasową (backup), aby zabezpieczyć swoje quizy i postępy.
            </p>
            <div className="flex gap-2">
              <Button onClick={downloadBackup}>Pobierz backup</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMigrationError(null);
                  appContext.setGuest(true);
                }}
              >
                Wróć
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isDataLoaded) {
    return (
      <div className="flex justify-center p-8">
        <Loader size={15} loading={true} />
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
            <div className="mt-4 flex justify-center">
              <Button variant="ghost" onClick={handleSkip}>
                Pomiń i zaloguj
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
            <Alert variant="destructive" className="mx-6 w-auto">
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
                  href={`${API_URL}/login/usos?jwt=true&redirect=${encodeURIComponent(
                    redirectUrl,
                  )}`}
                >
                  Zaloguj się z USOS
                </a>
              </Button>
              <Button asChild>
                <a href={`${API_URL}/login?jwt=true&redirect=${redirectUrl}`}>
                  Zaloguj się z Solvro Auth
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Anuluj i kontynuuj jako gość</Link>
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
                <Link href="/">Strona główna</Link>
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
