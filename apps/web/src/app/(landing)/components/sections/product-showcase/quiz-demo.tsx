"use client";

import { AccessLevel } from "@testownik/core/quiz/types";
import type { QuizBase } from "@testownik/core/quiz/types";
import { ACCOUNT_LEVEL, ACCOUNT_TYPE } from "@testownik/core/user/types";
import type { Group, User } from "@testownik/core/user/types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Link2Icon,
  Share2Icon,
  SparklesIcon,
  TimerIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PREVIEW_QUIZ } from "@/app/(landing)/preview/preview-fixtures";
import {
  PreviewRuntime,
  PreviewSandbox,
} from "@/app/(landing)/preview/preview-provider";
import { QuizPreviewSurface } from "@/app/(landing)/preview/product-surfaces";
import { AiExplanationCard, AiHintCard } from "@/components/ai/ai-explain-card";
import type { AnswerHint } from "@/components/ai/ai-explain-card";
import { useStudyTimeValue } from "@/components/quiz/hooks/use-study-timer";
import { AccessLevelSelector } from "@/components/quiz/share-quiz-dialog/access-level-selector";
import { AccessList } from "@/components/quiz/share-quiz-dialog/access-list";
import { SearchResultsPopover } from "@/components/quiz/share-quiz-dialog/search-results-popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getShowcaseExplanation, getShowcaseHint } from "./showcase-quiz";
import { useShowcaseSession } from "./showcase-session-context";

const QUIZ_TITLE = PREVIEW_QUIZ.title;
const QUIZ_ID = PREVIEW_QUIZ.id;

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
  triggerReference,
}: {
  open: boolean;
  onClose: () => void;
  triggerReference: React.RefObject<HTMLButtonElement | null>;
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent
        aria-labelledby="landing-share-title"
        finalFocus={triggerReference}
        className="max-w-lg min-w-0 gap-3 p-4 sm:max-w-lg sm:gap-4 sm:p-5"
        overlayClassName="bg-black/40"
      >
        <div className="pr-8">
          <DialogTitle id="landing-share-title">
            Udostępnij &quot;{QUIZ_TITLE}&quot;
          </DialogTitle>
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-4">
          <Popover open={searchQuery.length > 0} modal={false}>
            <PopoverTrigger
              nativeButton={false}
              render={
                <div className="relative w-full min-w-0">
                  <Input
                    aria-label="Znajdź osobę lub grupę"
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
      </DialogContent>
    </Dialog>
  );
}

/**
 * The quiz page's question card on the showcase's quiz session (see
 * `ShowcaseSessionProvider`), with the quiz header's AI, share and timer.
 * Questions the AI demo's assistant adds or edits are part of the same quiz,
 * so the header's question list grows and they can be opened here.
 */
export function QuizDemo(): React.JSX.Element {
  const { quiz: session } = useShowcaseSession();
  const { view, state } = session;
  const elapsedSeconds = useStudyTimeValue(session.timer);
  const [shareOpen, setShareOpen] = useState(false);
  const shareTriggerReference = useRef<HTMLButtonElement>(null);
  // The question the AI card is open for; moving on closes it.
  const [aiQuestionId, setAiQuestionId] = useState<string | null>(null);
  const [answerHints, setAnswerHints] = useState<AnswerHint[]>([]);
  const question = view.question;
  const checked = view.questionChecked;
  const aiOpen = question !== null && aiQuestionId === question.id;
  const aiLabel = checked ? "Wyjaśnij pytanie" : "Podpowiedz";
  const { questions } = state;
  const index =
    question === null
      ? -1
      : questions.findIndex((candidate) => candidate.id === question.id);

  const openAi = (): void => {
    setAnswerHints([]);
    setAiQuestionId(question?.id ?? null);
  };
  const closeAi = (): void => {
    setAiQuestionId(null);
    setAnswerHints([]);
  };
  const goTo = (offset: -1 | 1): void => {
    const target =
      questions[
        (Math.max(index, 0) + offset + questions.length) % questions.length
      ];
    session.goTo(target.id);
  };

  return (
    <PreviewSandbox className="rounded-[1rem]">
      <PreviewRuntime client={session.client}>
        <div className="bg-background text-foreground relative flex max-h-full min-h-[32rem] flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5 sm:min-h-[35rem]">
          <header className="border-border bg-card border-b px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate text-sm sm:text-base">
                  {QUIZ_TITLE}
                </strong>
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  {PREVIEW_QUIZ.description}
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
                        disabled={aiOpen || question === null}
                        onClick={openAi}
                      >
                        <SparklesIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>{aiLabel}</TooltipContent>
                </Tooltip>
                <Button
                  ref={shareTriggerReference}
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
                    className="text-landing-primary size-4 animate-pulse"
                  />
                  {formatTimer(elapsedSeconds)}
                </div>
              </div>
            </div>
            <nav
              aria-label="Pytania quizu"
              className="text-muted-foreground mt-3 flex items-center gap-1 text-xs font-medium"
            >
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Pokaż poprzednie pytanie"
                disabled={questions.length < 2}
                onClick={() => {
                  goTo(-1);
                }}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="tabular-nums" aria-live="polite">
                Pytanie {Math.max(index + 1, 1)} z {questions.length}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Pokaż następne pytanie"
                disabled={questions.length < 2}
                onClick={() => {
                  goTo(1);
                }}
              >
                <ChevronRightIcon />
              </Button>
            </nav>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-5 [&_[data-slot=card]]:shadow-none">
            <QuizPreviewSurface
              session={session}
              answerHints={aiOpen ? answerHints : undefined}
            />
            {aiOpen ? (
              checked ? (
                <AiExplanationCard
                  question={question}
                  onClose={closeAi}
                  preview={getShowcaseExplanation(question)}
                />
              ) : (
                <AiHintCard
                  question={question}
                  onClose={closeAi}
                  onAnswerHints={setAnswerHints}
                  preview={getShowcaseHint(question)}
                />
              )
            ) : null}
          </div>

          <QuizShareOverlay
            open={shareOpen}
            triggerReference={shareTriggerReference}
            onClose={() => {
              setShareOpen(false);
            }}
          />
        </div>
      </PreviewRuntime>
    </PreviewSandbox>
  );
}
