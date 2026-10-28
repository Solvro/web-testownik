import { describe, expect, it } from "vitest";

import {
  editDistance,
  gradeResponse,
  matchesOpenAnswer,
  simplifyAnswerText,
  typoAllowance,
} from "./grading";
import type { GradableQuestion } from "./grading";
import vectors from "./grading.vectors.json";
import type { OpenMatching } from "./types";

const choice = (
  type: GradableQuestion["type"],
  correct: string[],
): GradableQuestion => ({
  type,
  open_matching: "exact",
  answers: ["a", "b", "c"].map((id) => ({
    id,
    text: id,
    is_correct: correct.includes(id),
  })),
});

const open = (
  matching: OpenMatching,
  ...accepted: string[]
): GradableQuestion => ({
  type: "open",
  open_matching: matching,
  answers: accepted.map((text, index) => ({
    id: String(index),
    text,
    is_correct: true,
  })),
});

describe("grading vectors shared with the backend", () => {
  for (const vector of vectors) {
    it(`${vector.mode}: "${vector.typed}" ${vector.match ? "matches" : "does not match"} "${vector.expected}"`, () => {
      expect(
        matchesOpenAnswer(
          vector.typed,
          [vector.expected],
          vector.mode as OpenMatching,
        ),
      ).toBe(vector.match);
    });
  }
});

describe("editDistance", () => {
  it("counts inserts, deletes and replacements", () => {
    expect(editDistance("", "")).toBe(0);
    expect(editDistance("kot", "")).toBe(3);
    expect(editDistance("kot", "kod")).toBe(1);
    expect(editDistance("kot", "koty")).toBe(1);
    expect(editDistance("kot", "ot")).toBe(1);
  });

  it("counts a swap of neighbours once", () => {
    expect(editDistance("ab", "ba")).toBe(1);
    expect(editDistance("fotosynteza", "fotosytneza")).toBe(1);
  });

  it("compares code points, not UTF-16 units", () => {
    expect(editDistance("😀a", "a")).toBe(1);
  });
});

describe("typoAllowance", () => {
  it("grows with the length of the expected answer", () => {
    expect(
      [0, 3, 4, 7, 8, 15, 16, 40].map((length) => typoAllowance(length)),
    ).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe("simplifyAnswerText", () => {
  it("drops diacritics, punctuation and symbols", () => {
    expect(simplifyAnswerText("  Zażółć, gęślą — jaźń! ")).toBe(
      "zazolc gesla jazn",
    );
    expect(simplifyAnswerText("H₂O")).toBe("h2o");
  });
});

describe("gradeResponse", () => {
  it("needs the exact set of correct answers for choice questions", () => {
    const question = choice("multiple_choice", ["a", "c"]);
    expect(gradeResponse(question, ["a", "c"])).toBe(true);
    expect(gradeResponse(question, ["c", "a"])).toBe(true);
    expect(gradeResponse(question, ["a"])).toBe(false);
    expect(gradeResponse(question, ["a", "b", "c"])).toBe(false);
    expect(gradeResponse(question, [])).toBe(false);
  });

  it("counts selecting nothing as right only when no answer is correct", () => {
    expect(gradeResponse(choice("multiple_choice", []), [])).toBe(true);
    expect(gradeResponse(choice("multiple_choice", []), ["a"])).toBe(false);
    expect(gradeResponse(choice("single_choice", ["a"]), [])).toBe(false);
    expect(gradeResponse(open("exact", ""), [])).toBe(false);
  });

  it("compares long answers for equality only", () => {
    const long = "a".repeat(600);
    expect(gradeResponse(open("similar", long), [long])).toBe(true);
    expect(gradeResponse(open("similar", long), [`${long}b`])).toBe(false);
  });

  it("grades true/false like any other choice", () => {
    expect(gradeResponse(choice("true_false", ["b"]), ["b"])).toBe(true);
    expect(gradeResponse(choice("true_false", ["b"]), ["a"])).toBe(false);
  });

  it("accepts any of the accepted answers of an open question", () => {
    const question = open("exact", "Warszawa", "Warsaw");
    expect(gradeResponse(question, ["warsaw"])).toBe(true);
    expect(gradeResponse(question, ["WARSZAWA "])).toBe(true);
    expect(gradeResponse(question, ["Kraków"])).toBe(false);
  });

  it("treats a skipped or malformed open response as wrong", () => {
    const question = open("similar", "Warszawa");
    expect(gradeResponse(question, [])).toBe(false);
    expect(gradeResponse(question, ["Warszawa", "Warszawa"])).toBe(false);
    expect(gradeResponse(question, ["Warszwa"])).toBe(true);
  });
});
