import type { Folder, QuizMetadata, SharedQuiz } from "@/types/quiz";

export type LibrarySortKey =
  | "name-asc"
  | "name-desc"
  | "newest"
  | "oldest"
  | "last-used";

export const DEFAULT_LIBRARY_SORT_KEY: LibrarySortKey = "last-used";

const collator = new Intl.Collator("pl-PL", {
  numeric: true,
  sensitivity: "base",
});

const getQuizTitle = (quiz: QuizMetadata | SharedQuiz): string => {
  return "quiz" in quiz ? quiz.quiz.title : quiz.title;
};

const getQuizCreatedAt = (quiz: QuizMetadata | SharedQuiz): number => {
  return new Date(
    "quiz" in quiz ? quiz.quiz.created_at : quiz.created_at,
  ).getTime();
};

const getQuizLastUsedAt = (quiz: QuizMetadata | SharedQuiz): number => {
  const lastUsedAt =
    "quiz" in quiz ? quiz.quiz.last_used_at : quiz.last_used_at;
  return new Date(lastUsedAt ?? 0).getTime();
};

const getFolderName = (folder: Folder): string => folder.name;

const getFolderCreatedAt = (folder: Folder): number => {
  return new Date(folder.created_at ?? 0).getTime();
};

const compareText = (a: string, b: string): number => collator.compare(a, b);

const compareBySortKey = (
  leftLabel: string,
  rightLabel: string,
  leftNewest: number,
  rightNewest: number,
  key: LibrarySortKey,
): number => {
  switch (key) {
    case "name-asc": {
      return compareText(leftLabel, rightLabel);
    }
    case "name-desc": {
      return compareText(rightLabel, leftLabel);
    }
    case "newest": {
      return rightNewest - leftNewest;
    }
    case "oldest": {
      return leftNewest - rightNewest;
    }
    case "last-used": {
      return rightNewest - leftNewest;
    }
  }
};

export function compareQuizzesByLibrarySort(
  left: QuizMetadata | SharedQuiz,
  right: QuizMetadata | SharedQuiz,
  key: LibrarySortKey,
): number {
  return compareBySortKey(
    getQuizTitle(left),
    getQuizTitle(right),
    key === "last-used" ? getQuizLastUsedAt(left) : getQuizCreatedAt(left),
    key === "last-used" ? getQuizLastUsedAt(right) : getQuizCreatedAt(right),
    key,
  );
}

export function compareFoldersByLibrarySort(
  left: Folder,
  right: Folder,
  key: LibrarySortKey,
): number {
  return compareBySortKey(
    getFolderName(left),
    getFolderName(right),
    getFolderCreatedAt(left),
    getFolderCreatedAt(right),
    key,
  );
}
