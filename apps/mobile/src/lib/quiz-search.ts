import type { QuizListItem } from "../components/quiz-list/types";
import { api } from "./api";
import { openedDate, questionCount } from "./collection-copy";
import type { Language } from "./locale";
import type { Translate } from "./user-error";

interface SearchResult {
  id: string;
  title: string;
  question_count?: number | null;
  last_used_at?: string | null;
  creator?: string | null;
  is_anonymous?: boolean;
}

const buckets = [
  "user_quizzes",
  "shared_quizzes",
  "group_quizzes",
  "public_quizzes",
] as const;

export type SearchResponse = Partial<
  Record<(typeof buckets)[number], SearchResult[]>
>;

export interface SearchSection {
  key: string;
  title: string;
  quizzes: QuizListItem[];
}

export const searchQuizzes = (term: string) =>
  api.request<SearchResponse>(
    `search-quizzes/?query=${encodeURIComponent(term)}`,
  );

/** Your own, shared, group and public results, each quiz listed once in its most personal group. */
export function searchSections(
  data: SearchResponse,
  t: Translate,
  language: Language,
): SearchSection[] {
  const titles = {
    user_quizzes: t("Twoje quizy", "Your Quizzes"),
    shared_quizzes: t("Udostępnione Tobie", "Shared with You"),
    group_quizzes: t("Z Twoich grup", "From Your Groups"),
    public_quizzes: t("Publiczne", "Public"),
  };
  const seen = new Set<string>();
  return buckets.map((key) => ({
    key,
    title: titles[key],
    quizzes: (data[key] ?? [])
      .filter((quiz) => {
        if (!quiz?.id || seen.has(quiz.id)) return false;
        seen.add(quiz.id);
        return true;
      })
      .map((quiz) => {
        const own = key === "user_quizzes";
        const creator =
          !own && quiz.creator && !quiz.is_anonymous ? quiz.creator : null;
        return {
          id: quiz.id,
          title: quiz.title,
          progress: null,
          canEdit: own,
          detail:
            [
              questionCount(quiz.question_count, language),
              creator ?? openedDate(quiz.last_used_at, language),
            ]
              .filter(Boolean)
              .join(" · ") || "Quiz",
        };
      }),
  }));
}
