import { describe, expect, it } from "vitest";
import {
  buildCourseView,
  earnedEcts,
  isPassSymbol,
  projectedAverage,
  termGradeOptions,
  weightedAverage,
} from "@testownik/core/grades/utils";
import type { Course } from "@testownik/core/user/types";
import { gradeSymbol } from "../src/lib/grades-ui";

const course = (
  id: string,
  value: number | null,
  ects: number,
  counts = true,
): Course => ({
  course_id: id,
  course_name: id,
  term_id: "2026",
  ects,
  passing_status: value != null && value >= 3 ? "passed" : "not_yet_passed",
  grades: [
    {
      value,
      value_symbol: value == null ? null : String(value),
      counts_into_average: counts,
    },
  ],
});

describe("shared web and mobile grade calculations", () => {
  it("weights only grades USOS includes, excluding ungraded and zero-credit courses", () => {
    const rows = [
      course("A", 4, 6),
      course("B", 3, 3),
      course("C", 5, 10, false),
      course("D", null, 5),
      course("E", 5, 0),
    ].map((item) => buildCourseView(item));
    expect(weightedAverage(rows)).toBeCloseTo(33 / 9);
  });
  it("predicts actual courses, includes an ungraded course only with an override, and never mutates originals", () => {
    const rows = [course("A", 4, 6), course("B", null, 3)].map((item) =>
      buildCourseView(item),
    );
    expect(projectedAverage(rows, { B: 5 })).toBeCloseTo(39 / 9);
    expect(projectedAverage(rows, { A: 3, B: 5 })).toBeCloseTo(33 / 9);
    expect(projectedAverage(rows, {})).toBe(4);
    expect(rows[1].mainValue).toBeNull();
  });
  it("returns no average when all selected semesters have no counted grades", () => {
    expect(weightedAverage([])).toBeNull();
    expect(
      weightedAverage([buildCourseView(course("pass", 5, 5, false))]),
    ).toBeNull();
  });
  it("combines semesters using course ECTS, not an average of term averages", () => {
    expect(
      weightedAverage(
        [course("A", 5, 30), course("B", 3, 10)].map((item) =>
          buildCourseView(item),
        ),
      ),
    ).toBe(4.5);
  });
  it("offers legacy 5.5 only when it occurs in the supplied term", () => {
    expect(
      termGradeOptions([buildCourseView(course("A", 4, 6))]),
    ).not.toContain(5.5);
    expect(termGradeOptions([buildCourseView(course("A", 5.5, 6))])).toContain(
      5.5,
    );
  });
});

describe("pass/fail grades", () => {
  // USOS sends these as a word; its status ignores grades outside the average.
  const passFail = (symbol: string, passes?: boolean): Course => ({
    course_id: symbol,
    course_name: symbol,
    term_id: "2026",
    ects: 2,
    passing_status: "not_yet_passed",
    grades: [
      { value: null, value_symbol: symbol, counts_into_average: false, passes },
    ],
  });
  const en = (_pl: string, english: string) => english;
  const pl = (polish: string) => polish;

  it.each(["zrealizowany", "Zaliczony", "zal.", "ZAL", "passed"])(
    "treats %s as passed",
    (symbol) => {
      expect(isPassSymbol(symbol)).toBe(true);
      expect(buildCourseView(passFail(symbol)).passed).toBe(true);
    },
  );
  it("trusts USOS's own passes flag for other words", () => {
    expect(buildCourseView(passFail("uczestniczył", true)).passed).toBe(true);
    expect(buildCourseView(passFail("nzal")).passed).toBe(false);
    expect(isPassSymbol("nzal")).toBe(false);
  });
  it("counts the ECTS and passed courses but never the average", () => {
    const rows = [course("A", 4, 6), passFail("zrealizowany")].map((item) =>
      buildCourseView(item),
    );
    expect(rows.filter((row) => row.passed)).toHaveLength(2);
    expect(earnedEcts(rows)).toBe(8);
    expect(weightedAverage(rows)).toBe(4);
    expect(projectedAverage(rows, {})).toBe(4);
  });
  it("shows a short localized mark instead of the raw USOS word", () => {
    expect(gradeSymbol("zrealizowany", en)).toBe("Passed");
    expect(gradeSymbol("zrealizowany", pl)).toBe("Zal.");
    expect(gradeSymbol("nzal", en)).toBe("nzal");
  });
});

describe("USOS empty-grade response", () => {
  it("shows the empty state only for the endpoint's explicit no-grades response", async () => {
    const { loadGrades } = await import("../src/lib/grades");
    const { ApiError } = await import("../src/lib/client");
    await expect(
      loadGrades(async () => {
        throw new ApiError(404, "No grade data found for this user.");
      }),
    ).resolves.toEqual({ terms: [], courses: [] });
    for (const error of [
      new ApiError(401, "Sign in"),
      new ApiError(404, "Not found"),
      new ApiError(500, "USOS unavailable"),
    ]) {
      await expect(
        loadGrades(async () => {
          throw error;
        }),
      ).rejects.toBe(error);
    }
  });
});
