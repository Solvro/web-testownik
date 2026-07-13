import type {
  Folder,
  LibraryItem,
  QuizMetadata,
  SharedQuiz,
} from "@/types/quiz";

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

const getQuizTitle = (
  quiz: QuizMetadata | SharedQuiz | LibraryItem,
): string => {
  if ("quiz" in quiz) {
    return quiz.quiz.title;
  } else if ("title" in quiz) {
    return quiz.title;
  } else if ("name" in quiz) {
    return quiz.name;
  }
  return "Unknown";
};

const getQuizCreatedAt = (
  quiz: QuizMetadata | SharedQuiz | LibraryItem,
): number => {
  let dateString: string | null | undefined = null;

  if ("quiz" in quiz) {
    dateString = quiz.quiz.created_at;
  } else if ("created_at" in quiz && !("type" in quiz)) {
    dateString = quiz.created_at;
  }

  return new Date(dateString ?? 0).getTime();
};

const getQuizLastUsedAt = (
  quiz: QuizMetadata | SharedQuiz | LibraryItem,
): number => {
  let dateString: string | null | undefined = null;

  if ("quiz" in quiz) {
    dateString = quiz.quiz.last_used_at;
  }
  if ("last_used_at" in quiz) {
    dateString = quiz.last_used_at;
  } else if ("created_at" in quiz) {
    dateString = quiz.created_at;
  }

  return new Date(dateString ?? 0).getTime();
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
  left: QuizMetadata | SharedQuiz | LibraryItem,
  right: QuizMetadata | SharedQuiz | LibraryItem,
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
