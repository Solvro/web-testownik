import type { QuizVersion } from "@testownik/core/quiz/types";
import { describe, expect, it } from "vitest";

import {
  authorLabel,
  describeSummary,
  formatWhen,
  plural,
} from "./version-history";

describe("Version history labels", () => {
  it("picks the Polish plural form", () => {
    expect(
      [1, 2, 4, 5, 12, 14, 22, 25, 112].map((count) =>
        plural(count, "pytanie", "pytania", "pytań"),
      ),
    ).toEqual([
      "pytanie",
      "pytania",
      "pytania",
      "pytań",
      "pytań",
      "pytań",
      "pytania",
      "pytań",
      "pytań",
    ]);
  });

  it("describes what a version changed", () => {
    expect(describeSummary({ created: true, added: 3 }, 3)).toBe(
      "Nowy quiz, 3 pytania",
    );
    expect(
      describeSummary({ added: 1, removed: 5, changed: 2, title: true }, 9),
    ).toBe(
      "Dodano 1 pytanie, usunięto 5 pytań, zmieniono 2 pytania, zmieniono tytuł",
    );
    expect(describeSummary({}, 4)).toBe("4 pytania");
  });

  it("formats when a version was saved", () => {
    const now = new Date(2026, 9, 6, 15, 0);
    expect(
      formatWhen(new Date(2026, 9, 6, 14, 59, 40).toISOString(), now),
    ).toBe("przed chwilą");
    expect(formatWhen(new Date(2026, 9, 6, 14, 55).toISOString(), now)).toBe(
      "5 minut temu",
    );
    expect(formatWhen(new Date(2026, 9, 6, 9, 5).toISOString(), now)).toBe(
      "dziś, 09:05",
    );
    expect(formatWhen(new Date(2026, 9, 5, 22, 30).toISOString(), now)).toBe(
      "wczoraj, 22:30",
    );
    expect(formatWhen(new Date(2026, 9, 1, 8, 0).toISOString(), now)).toMatch(
      /^1 paź, 08:00$/,
    );
    expect(formatWhen(new Date(2025, 0, 2, 8, 0).toISOString(), now)).toMatch(
      /^2 sty 2025, 08:00$/,
    );
  });

  it("names the author, or 'Ty' for the current user", () => {
    const base: QuizVersion = {
      version: 1,
      created_at: "",
      updated_at: "",
      author: {
        id: "u1",
        full_name: "Ada Autorka",
        photo: "",
        student_number: "",
      },
      source: "editor",
      restored_from: null,
      title: "",
      question_count: 0,
      summary: {},
    };
    expect(authorLabel(base, "u1")).toBe("Ty");
    expect(authorLabel(base, "u2")).toBe("Ada Autorka");
    expect(authorLabel({ ...base, author: null }, "u1")).toBe("Nieznany autor");
    expect(authorLabel({ ...base, author: null, source: "baseline" })).toBe(
      "Nieznany autor",
    );
  });
});
