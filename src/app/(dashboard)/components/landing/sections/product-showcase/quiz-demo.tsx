"use client";

import {
  Link2Icon,
  Share2Icon,
  SparklesIcon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AiExplanationCard,
  AiHintCard,
  type AnswerHint,
} from "@/components/ai/ai-explain-card";
import { QuestionCard } from "@/components/quiz/question-card";
import { AccessLevelSelector } from "@/components/quiz/share-quiz-dialog/access-level-selector";
import { AccessList } from "@/components/quiz/share-quiz-dialog/access-list";
import { SearchResultsPopover } from "@/components/quiz/share-quiz-dialog/search-results-popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AnswerRecord, Question, QuizBase } from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";
import { ACCOUNT_LEVEL, ACCOUNT_TYPE } from "@/types/user";
import type { Group, User } from "@/types/user";

const QUIZ_TITLE = "Jak uczyć się skuteczniej?";
const QUIZ_ID = "landing-product-quiz";

const QUESTIONS: readonly Question[] = [
  {
    id: "landing-q-1",
    order: 1,
    text: "Która technika najskuteczniej sprawdza, czy naprawdę pamiętasz materiał?",
    multiple: false,
    explanation:
      "Aktywne przypominanie wymaga odtworzenia wiedzy bez podpowiedzi.",
    answers: [
      {
        id: "q1-a",
        order: 1,
        text: "Ponowne czytanie notatek",
        is_correct: false,
      },
      { id: "q1-b", order: 2, text: "Aktywne przypominanie", is_correct: true },
      {
        id: "q1-c",
        order: 3,
        text: "Podkreślanie definicji",
        is_correct: false,
      },
      {
        id: "q1-d",
        order: 4,
        text: "Oglądanie gotowego rozwiązania",
        is_correct: false,
      },
    ],
  },
  {
    id: "landing-q-2",
    order: 2,
    text: "Które działania pomagają dobrze zaplanować powtórki? Zaznacz wszystkie poprawne.",
    multiple: true,
    explanation:
      "Najlepiej działa regularne wydobywanie wiedzy z pamięci i szybszy powrót do trudnych tematów.",
    answers: [
      {
        id: "q2-a",
        order: 1,
        text: "Rozkładanie nauki w czasie",
        is_correct: true,
      },
      {
        id: "q2-b",
        order: 2,
        text: "Wracanie częściej do błędnych pytań",
        is_correct: true,
      },
      {
        id: "q2-c",
        order: 3,
        text: "Jedna bardzo długa sesja",
        is_correct: false,
      },
      {
        id: "q2-d",
        order: 4,
        text: "Pomijanie pytań, które sprawiają trudność",
        is_correct: false,
      },
    ],
  },
  {
    id: "landing-q-3",
    order: 3,
    text: "Po sesji masz 72% poprawnych odpowiedzi. Co da Ci najwięcej przed kolejną próbą?",
    multiple: false,
    explanation:
      "Analiza błędów pozwala rozpoznać konkretną lukę, zamiast powtarzać cały materiał od początku.",
    answers: [
      {
        id: "q3-a",
        order: 1,
        text: "Powtórzenie tylko łatwych pytań",
        is_correct: false,
      },
      {
        id: "q3-b",
        order: 2,
        text: "Przejrzenie błędów i ich wyjaśnień",
        is_correct: true,
      },
      {
        id: "q3-c",
        order: 3,
        text: "Natychmiastowy reset wyniku",
        is_correct: false,
      },
      {
        id: "q3-d",
        order: 4,
        text: "Zmiana kolejności odpowiedzi",
        is_correct: false,
      },
    ],
  },
];

/** Static fixtures shaped like real `/ai/hint` + `/ai/explain` output — no API. */
const STATIC_AI_BY_QUESTION: Record<
  string,
  { generalHint: string; answerHints: AnswerHint[]; explanation: string }
> = {
  "landing-q-1": {
    generalHint:
      "Zastanów się, która metoda **wymaga od Ciebie samodzielnego odtworzenia** wiedzy, zamiast tylko ponownego kontaktu z materiałem.",
    answerHints: [
      {
        answerIndex: 0,
        hint: "Czytanie jest pasywne — rozpoznajesz treść, ale nie sprawdzasz, czy potrafisz ją wydobyć.",
      },
      {
        answerIndex: 1,
        hint: "Tu musisz **samodzielnie przypomnieć** sobie odpowiedź. To najmocniejszy sygnał, że naprawdę pamiętasz.",
      },
      {
        answerIndex: 2,
        hint: "Podkreślanie pomaga zaznaczyć fragmenty, ale słabo weryfikuje pamięć.",
      },
      {
        answerIndex: 3,
        hint: "Gotowe rozwiązanie pokazuje wynik, nie Twoją umiejętność przypominania.",
      },
    ],
    explanation:
      "Aktywne przypominanie działa najlepiej, bo zmusza mózg do wyszukania informacji bez podpowiedzi. Ponowne czytanie i podkreślanie dają złudzenie znajomości materiału — rozpoznajesz tekst, ale nie ćwiczysz odtwarzania. Dlatego w Testowniku pytania i powtórki budują właśnie ten mechanizm.",
  },
  "landing-q-2": {
    generalHint:
      "Szukaj strategii, które **rozciągają naukę w czasie** i wracają do tego, co poszło najgorzej.",
    answerHints: [
      {
        answerIndex: 0,
        hint: "Rozłożenie nauki zmniejsza zapominanie między sesjami.",
      },
      {
        answerIndex: 1,
        hint: "Trudne pytania zasługują na **częstsze powtórki** — to tu rośnie wynik.",
      },
      {
        answerIndex: 2,
        hint: "Jedna długa sesja męczy i słabiej utrwala niż kilka krótszych.",
      },
      {
        answerIndex: 3,
        hint: "Pomijanie trudnych tematów zostawia największe luki na egzaminie.",
      },
    ],
    explanation:
      "Skuteczny plan łączy spacing (nauka w odstępach) z priorytetem błędów. Jedna maratonowa sesja i unikanie trudnych pytań wyglądają na postęp, ale nie budują trwałej pamięci. W praktyce: wracaj częściej do tego, co poszło źle, i rozkładaj powtórki na kilka dni.",
  },
  "landing-q-3": {
    generalHint:
      "Przy 72% największy zysk daje praca nad tym, **czego jeszcze nie umiesz** — nie nad tym, co już działa.",
    answerHints: [
      {
        answerIndex: 0,
        hint: "Łatwe pytania podnoszą pewność, ale słabo podnoszą wynik.",
      },
      {
        answerIndex: 1,
        hint: "Błędy + wyjaśnienia pokazują konkretną lukę do domknięcia.",
      },
      {
        answerIndex: 2,
        hint: "Reset wyniku kasuje historię, ale nie uczy materiału.",
      },
      {
        answerIndex: 3,
        hint: "Kolejność odpowiedzi nie zmienia Twojej wiedzy merytorycznej.",
      },
    ],
    explanation:
      "Najlepszy ruch po sesji to przegląd błędów i ich wyjaśnień. Widzisz, które pojęcia są dziurawe, i możesz celować powtórkę dokładnie tam. Reset czy układanie odpowiedzi na nowo nie naprawia luk — tylko analiza pomyłek daje konkretny plan na kolejną rundę.",
  },
};

const HISTORY: AnswerRecord[] = [
  {
    id: "landing-history-1",
    question: "landing-q-1",
    answered_at: "2026-01-15T18:30:00.000Z",
    selected_answers: ["q1-a"],
    was_correct: false,
  },
  {
    id: "landing-history-2",
    question: "landing-q-1",
    answered_at: "2026-01-16T18:30:00.000Z",
    selected_answers: ["q1-b"],
    was_correct: true,
  },
];

const CREATOR: User = {
  id: "landing-creator",
  full_name: "Antoni Czaplicki",
  photo: "https://github.com/Antoni-Czaplicki.png",
  student_number: "268431",
  account_type: ACCOUNT_TYPE.STUDENT,
  account_level: ACCOUNT_LEVEL.GOLD,
};

const QUIZ: QuizBase = {
  id: QUIZ_ID,
  title: QUIZ_TITLE,
  description: "Praktyczny zestaw do samodzielnej nauki",
  creator: CREATOR,
  visibility: AccessLevel.UNLISTED,
  allow_anonymous: true,
  is_anonymous: false,
  version: 1,
  can_edit: true,
};

const SEARCHABLE_USERS: User[] = [
  {
    id: "landing-user-franek",
    full_name: "Franek Wiśniewski",
    photo:
      "https://ui-avatars.com/api/?background=b45309&color=fff&name=Franek+Wisniewski&size=128",
    student_number: "271002",
    account_type: ACCOUNT_TYPE.STUDENT,
    account_level: ACCOUNT_LEVEL.BASIC,
  },
  {
    id: "landing-user-asia",
    full_name: "Asia Lewandowska",
    photo:
      "https://ui-avatars.com/api/?background=be185d&color=fff&name=Asia+Lewandowska&size=128",
    student_number: "269118",
    account_type: ACCOUNT_TYPE.STUDENT,
    account_level: ACCOUNT_LEVEL.BASIC,
  },
];

const TERM = {
  id: "landing-term",
  name: "2025/26 Lato",
  start_date: "2026-02-24",
  end_date: "2026-06-30",
  finish_date: "2026-09-30",
  is_current: true,
};

const INITIAL_USER: User & { shared_quiz_id?: string; allow_edit: boolean } = {
  id: "landing-user-ola",
  full_name: "Ola Nowak",
  photo:
    "https://ui-avatars.com/api/?background=0f766e&color=fff&name=Ola+Nowak&size=128",
  student_number: "270441",
  account_type: ACCOUNT_TYPE.STUDENT,
  account_level: ACCOUNT_LEVEL.BASIC,
  shared_quiz_id: "share-ola",
  allow_edit: false,
};

const INITIAL_GROUP: Group & {
  shared_quiz_id?: string;
  allow_edit: boolean;
} = {
  id: "landing-group-si",
  name: "KN Solvro",
  photo:
    "https://ui-avatars.com/api/?background=7c3aed&color=fff&name=KN+Solvro&size=128",
  term: TERM,
  shared_quiz_id: "share-group",
  allow_edit: true,
};

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * In-screen 1:1 stand-in for ShareQuizDialog using the real share pieces.
 * Contained inside the demo chrome — no page scroll, no body portal.
 */
function QuizShareOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(
    AccessLevel.UNLISTED,
  );
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [isCreatorAnonymous, setIsCreatorAnonymous] = useState(false);
  const [usersWithAccess, setUsersWithAccess] = useState([INITIAL_USER]);
  const [groupsWithAccess, setGroupsWithAccess] = useState([INITIAL_GROUP]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(User | Group)[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const takenIds = new Set([
    CREATOR.id,
    ...usersWithAccess.map((user) => user.id),
    ...groupsWithAccess.map((group) => group.id),
  ]);

  const handleSearchInput = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const query = event.target.value;
    setSearchQuery(query);
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearchResults(
      SEARCHABLE_USERS.filter(
        (user) =>
          !takenIds.has(user.id) &&
          (user.full_name.toLowerCase().includes(normalized) ||
            user.student_number.includes(normalized)),
      ),
    );
  };

  const handleAddEntity = (entity: User | Group): void => {
    if ("full_name" in entity) {
      setUsersWithAccess((current) => [
        ...current,
        { ...entity, allow_edit: false, shared_quiz_id: `share-${entity.id}` },
      ]);
    } else {
      setGroupsWithAccess((current) => [
        ...current,
        { ...entity, allow_edit: false, shared_quiz_id: `share-${entity.id}` },
      ]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Zamknij udostępnianie"
        className="absolute inset-0 bg-black/40 supports-backdrop-filter:backdrop-blur-xs"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-share-title"
        className={cn(
          "bg-popover text-popover-foreground ring-foreground/10 relative z-10 grid w-full max-w-lg gap-3 rounded-xl p-4 text-sm ring-1 sm:gap-4 sm:p-5",
          "max-h-full min-w-0",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label="Zamknij"
          onClick={onClose}
        >
          <XIcon />
        </Button>

        <div className="pr-8">
          <h2
            id="landing-share-title"
            className="cn-font-heading text-lg leading-none font-semibold"
          >
            Udostępnij &quot;{QUIZ_TITLE}&quot;
          </h2>
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-4">
          <Popover open={searchQuery.length > 0} modal={false}>
            <PopoverTrigger
              nativeButton={false}
              render={
                <div className="relative w-full min-w-0">
                  <Input
                    placeholder="Wpisz imię/nazwisko, grupę lub numer indeksu..."
                    value={searchQuery}
                    onChange={handleSearchInput}
                  />
                </div>
              }
            />
            {searchQuery.length > 0 ? (
              <SearchResultsPopover
                searchResults={searchResults}
                searchResultsLoading={false}
                handleAddEntity={handleAddEntity}
                searchQuery={searchQuery}
                className="max-h-40 overflow-hidden"
              />
            ) : null}
          </Popover>

          <div className="min-w-0 space-y-2">
            <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Dostęp mają:
            </h5>
            <div className="min-w-0 [&_[data-slot=scroll-area-scrollbar]]:hidden [&_[data-slot=scroll-area-viewport]]:!max-h-none [&_[data-slot=scroll-area-viewport]]:!overflow-visible">
              <AccessList
                quizMetadata={QUIZ}
                usersWithAccess={usersWithAccess}
                groupsWithAccess={groupsWithAccess}
                isCreatorAnonymous={isCreatorAnonymous}
                setIsCreatorAnonymous={setIsCreatorAnonymous}
                handleRemoveUserAccess={(user) => {
                  setUsersWithAccess((current) =>
                    current.filter((entry) => entry.id !== user.id),
                  );
                }}
                handleRemoveGroupAccess={(group) => {
                  setGroupsWithAccess((current) =>
                    current.filter((entry) => entry.id !== group.id),
                  );
                }}
                handleToggleUserEdit={(user) => {
                  setUsersWithAccess((current) =>
                    current.map((entry) =>
                      entry.id === user.id
                        ? { ...entry, allow_edit: !entry.allow_edit }
                        : entry,
                    ),
                  );
                }}
                handleToggleGroupEdit={(group) => {
                  setGroupsWithAccess((current) =>
                    current.map((entry) =>
                      entry.id === group.id
                        ? { ...entry, allow_edit: !entry.allow_edit }
                        : entry,
                    ),
                  );
                }}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-2 overflow-visible">
            <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Poziom dostępu:
            </h5>
            <div className="min-w-0 overflow-visible px-1.5 py-2">
              <AccessLevelSelector
                value={accessLevel}
                onChange={setAccessLevel}
              />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="landing-allow-anonymous"
                checked={
                  allowAnonymous ? accessLevel >= AccessLevel.UNLISTED : false
                }
                onCheckedChange={(checkedValue) => {
                  if (typeof checkedValue === "boolean") {
                    setAllowAnonymous(checkedValue);
                  }
                }}
                disabled={accessLevel < AccessLevel.UNLISTED}
              />
              <Label htmlFor="landing-allow-anonymous">
                Pozwól na dostęp dla niezalogowanych/gości
              </Label>
            </div>
          </div>

          {accessLevel === AccessLevel.PRIVATE &&
          (usersWithAccess.length > 0 || groupsWithAccess.length > 0) ? (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
              Ustawiono dostęp prywatny, ale dodano użytkowników/grupy. Quiz nie
              będzie dla nich dostępny.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={() => {
              toast.success("Skopiowano link do quizu");
            }}
          >
            <Link2Icon className="size-4" />
            Kopiuj link
          </Button>
          <div className="flex flex-wrap-reverse gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="button" onClick={onClose}>
              Zapisz
            </Button>
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="sm:hidden"
            onClick={() => {
              toast.success("Skopiowano link do quizu");
            }}
          >
            <Link2Icon className="size-4" />
            Kopiuj link
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QuizDemo(): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(4 * 60 + 36);
  const [answersByQuestion, setAnswersByQuestion] = useState<
    Record<string, string[]>
  >({});
  const [checkedByQuestion, setCheckedByQuestion] = useState<
    Record<string, boolean>
  >({});
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [answerHints, setAnswerHints] = useState<AnswerHint[]>([]);
  const question = QUESTIONS[index] ?? QUESTIONS[0];
  const selectedAnswers = answersByQuestion[question.id] ?? [];
  const checked = checkedByQuestion[question.id] ?? false;
  const staticAi = STATIC_AI_BY_QUESTION[question.id];
  const aiLabel = checked ? "Wyjaśnij pytanie" : "Podpowiedz";

  const closeAi = (): void => {
    setAiOpen(false);
    setAnswerHints([]);
  };

  const openAi = (): void => {
    setAiOpen(true);
    setAnswerHints([]);
  };

  const goTo = (nextIndex: number): void => {
    closeAi();
    setIndex((nextIndex + QUESTIONS.length) % QUESTIONS.length);
  };

  const advanceQuestion = (): void => {
    if (index === QUESTIONS.length - 1) {
      closeAi();
      setIndex(0);
      setAnswersByQuestion({});
      setCheckedByQuestion({});
      return;
    }

    goTo(index + 1);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="bg-background text-foreground relative flex h-full min-h-[35rem] flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5">
      <header className="border-border bg-card border-b px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <strong className="block truncate text-sm sm:text-base">
              {QUIZ_TITLE}
            </strong>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Praktyczny zestaw do samodzielnej nauki
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={aiLabel}
                    disabled={aiOpen}
                    onClick={openAi}
                  >
                    <SparklesIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>{aiLabel}</TooltipContent>
            </Tooltip>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Udostępnij quiz"
              onClick={() => {
                setShareOpen(true);
              }}
            >
              <Share2Icon className="size-3.5" />
            </Button>
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold tabular-nums">
              <TimerIcon
                aria-hidden="true"
                className="text-primary size-4 animate-pulse"
              />
              {formatTimer(elapsedSeconds)}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-5 [&_[data-slot=card]]:shadow-none">
        <QuestionCard
          quizId={QUIZ_ID}
          question={question}
          selectedAnswers={selectedAnswers}
          setSelectedAnswers={(next) => {
            setAnswersByQuestion((current) => ({
              ...current,
              [question.id]: next,
            }));
          }}
          answers={HISTORY}
          questionChecked={checked}
          nextAction={() => {
            if (checked) {
              advanceQuestion();
              return;
            }
            setCheckedByQuestion((current) => ({
              ...current,
              [question.id]: true,
            }));
          }}
          isQuizFinished={false}
          togglePreviousQuestion={() => {
            goTo(index - 1);
          }}
          canGoBack={index > 0}
          isHistoryQuestion={false}
          answerHints={answerHints}
        />
        {aiOpen && staticAi !== undefined ? (
          checked ? (
            <AiExplanationCard
              question={question}
              onClose={closeAi}
              preview={staticAi.explanation}
            />
          ) : (
            <AiHintCard
              question={question}
              onClose={closeAi}
              onAnswerHints={setAnswerHints}
              preview={{
                generalHint: staticAi.generalHint,
                answerHints: staticAi.answerHints,
              }}
            />
          )
        ) : null}
      </div>

      <QuizShareOverlay
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
        }}
      />
    </div>
  );
}
