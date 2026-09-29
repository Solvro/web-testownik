import { test, expect } from "@playwright/test";
import type { Course, GradesData } from "@testownik/core/user/types";
const course = (
  id: string,
  term: string,
  value: number | null,
  ects: number,
): Course => ({
  course_id: id,
  course_name: `Course ${id}`,
  term_id: term,
  ects,
  passing_status: value && value >= 3 ? "passed" : "not_yet_passed",
  grades: [
    {
      value,
      value_symbol: value == null ? null : String(value),
      counts_into_average: true,
    },
  ],
});
const data: GradesData = {
  terms: [
    {
      id: "now",
      name: "2026 Summer",
      start_date: "2026-02-01",
      end_date: "2026-09-30",
      finish_date: "2026-09-30",
      is_current: true,
    },
    {
      id: "before",
      name: "2025 Winter",
      start_date: "2025-10-01",
      end_date: "2026-01-31",
      finish_date: "2026-01-31",
      is_current: false,
    },
  ],
  courses: [
    course("A", "now", 4, 6),
    course("B", "now", null, 3),
    course("A", "before", 5, 6),
  ],
};
for (const language of ["en", "pl"] as const)
  test(`${language}: grades, local prediction, semester isolation and combined average`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "grades-fixture", refresh: "grades-refresh" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    const writes: string[] = [];
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes.push(path);
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "grades-fixture", is_guest: false, account_type: "student" }
          : path.endsWith("/grades/")
            ? data
            : [],
      });
    });
    const pl = language === "pl",
      format = (text: string) => (pl ? text.replace(".", ",") : text);
    await page.goto("/grades");
    await expect(page.getByTestId("grade-average")).toHaveText(format("4.000"));
    await page.getByTestId("grade-course-A").click();
    await expect(
      page.getByText(
        pl ? "Wliczana do średniej" : "Counts towards the average",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: pl ? "Zamknij" : "Close", exact: true })
      .click();
    await page
      .getByRole("radio", { name: pl ? "Symulator" : "Simulator", exact: true })
      .click();
    const reset = page.getByRole("button", {
      name: pl ? "Resetuj prognozę" : "Reset predictions",
      exact: true,
    });
    await expect(reset).toBeDisabled();
    await page
      .getByRole("radiogroup", {
        name: `${pl ? "Prognoza" : "Prediction"}: Course A`,
        exact: true,
      })
      .getByRole("radio", { name: format("3.0"), exact: true })
      .click();
    await expect(page.getByTestId("grade-average")).toHaveText(format("3.000"));
    await expect(page.getByTestId("grade-value-A")).toHaveText(format("3.0"));
    await expect(page.getByTestId("grade-course-A")).toContainText(
      `USOS ${format("4.0")}`,
    );
    await expect(page.getByTestId("grade-course-A")).not.toContainText(
      pl ? "Zaliczony" : "Passed",
    );
    await page
      .getByRole("button", {
        name: pl ? "Poprzedni semestr" : "Previous semester",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("grade-average")).toHaveText(format("5.000"));
    await expect(reset).toBeDisabled();
    await page
      .getByRole("button", {
        name: pl ? "Następny semestr" : "Next semester",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("grade-average")).toHaveText(format("3.000"));
    await page
      .getByRole("radiogroup", {
        name: `${pl ? "Prognoza" : "Prediction"}: Course B`,
        exact: true,
      })
      .getByRole("radio", { name: format("5.0"), exact: true })
      .click();
    await expect(page.getByTestId("grade-average")).toHaveText(format("3.667"));
    await page.screenshot({
      path: `test-results/grades-simulator-${language}-${test.info().project.name}.png`,
    });
    await reset.click();
    await expect(page.getByTestId("grade-average")).toHaveText(format("4.000"));
    await expect(page.getByTestId("grade-value-A")).toHaveText(format("4.0"));
    await page
      .getByRole("radiogroup", {
        name: `${pl ? "Prognoza" : "Prediction"}: Course A`,
        exact: true,
      })
      .getByRole("radio", { name: format("4.0"), exact: true })
      .click();
    await expect(reset).toBeDisabled();
    await page
      .getByRole("radio", { name: pl ? "Oceny" : "Grades", exact: true })
      .click();
    await page.screenshot({
      path: `test-results/grades-overview-${language}-${test.info().project.name}.png`,
    });
    await page
      .getByRole("button", {
        name: pl ? /^Wszystkie semestry,/ : /^All Semesters,/,
      })
      .click();
    await expect(page.getByTestId("combined-average")).toHaveText(
      format("4.500"),
    );
    await page
      .getByRole("button", {
        name: pl ? "Odznacz wszystkie" : "Deselect All",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("combined-average")).toHaveText("—");
    await page
      .getByRole("button", { name: pl ? "Zamknij" : "Close", exact: true })
      .click();
    await page.getByTestId("choose-semester").click();
    await page.getByRole("radio", { name: "2025 Winter", exact: true }).click();
    await expect(page.getByTestId("grade-average")).toHaveText(format("5.000"));
    expect(writes).toEqual([]);
  });
