import type {
  QuizVersion,
  QuizVersionSummary,
} from "@testownik/core/quiz/types";

export function quizVersionsQueryKey(quizId: string) {
  return ["quiz-versions", quizId] as const;
}

/** Polish noun form for a count, e.g. 1 pytanie, 2 pytania, 5 pytań. */
export function plural(count: number, one: string, few: string, many: string) {
  if (count === 1) {
    return one;
  }
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? few
    : many;
}

function questions(count: number) {
  return `${String(count)} ${plural(count, "pytanie", "pytania", "pytań")}`;
}

const time = new Intl.DateTimeFormat("pl", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayThisYear = new Intl.DateTimeFormat("pl", {
  day: "numeric",
  month: "short",
});
const dayOtherYear = new Intl.DateTimeFormat("pl", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const relative = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });

/** "przed chwilą", "5 minut temu", "dziś, 14:32", "wczoraj, 9:05", "3 paź, 14:32". */
export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) {
    return "przed chwilą";
  }
  if (minutes < 60) {
    return relative.format(-minutes, "minute");
  }
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const days = Math.ceil(
    (startOfDay.getTime() - date.getTime()) / (24 * 60 * 60_000),
  );
  const clock = time.format(date);
  if (date >= startOfDay) {
    return `dziś, ${clock}`;
  }
  if (days <= 1) {
    return `wczoraj, ${clock}`;
  }
  const day =
    date.getFullYear() === now.getFullYear()
      ? dayThisYear.format(date)
      : dayOtherYear.format(date);
  return `${day}, ${clock}`;
}

export function sourceLabel(version: QuizVersion) {
  switch (version.source) {
    case "baseline": {
      return "Stan początkowy";
    }
    case "create": {
      return "Utworzenie quizu";
    }
    case "copy": {
      return "Kopia innego quizu";
    }
    case "editor": {
      return "Zapis w edytorze";
    }
    case "question": {
      return "Edycja pojedynczego pytania";
    }
    case "mcp": {
      return "Asystent AI";
    }
    case "restore": {
      return version.restored_from === null
        ? "Przywrócenie wersji"
        : `Przywrócenie wersji ${String(version.restored_from)}`;
    }
  }
}

/** What a version changed, e.g. "dodano 2 pytania, zmieniono tytuł". */
export function describeSummary(
  summary: QuizVersionSummary,
  questionCount: number,
) {
  if (summary.created === true) {
    return `Nowy quiz, ${questions(questionCount)}`;
  }
  const parts = [
    summary.added === undefined ? null : `dodano ${questions(summary.added)}`,
    summary.removed === undefined
      ? null
      : `usunięto ${questions(summary.removed)}`,
    summary.changed === undefined
      ? null
      : `zmieniono ${questions(summary.changed)}`,
    summary.reordered === true ? "zmieniono kolejność" : null,
    summary.title === true ? "zmieniono tytuł" : null,
    summary.description === true ? "zmieniono opis" : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) {
    return questions(questionCount);
  }
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Who saved a version: "Ty" for the current user, else their name. */
export function authorLabel(version: QuizVersion, currentUserId?: string) {
  if (version.author === null) {
    return "Nieznany autor";
  }
  if (version.author.id === currentUserId) {
    return "Ty";
  }
  const name = version.author.full_name.trim();
  return name === "" ? "Nieznany autor" : name;
}
