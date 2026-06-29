import {
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http } from "msw";
import { describe, expect, it } from "vitest";

import { GradesPageClient as GradesPage } from "@/app/grades/client";
import {
  emptyCourse,
  mockCourses,
  mockTerms,
} from "@/test-utils/mocks/grade-mock";
import { server } from "@/test-utils/mocks/server";
import { Providers } from "@/test-utils/providers";
import { generateTestToken } from "@/test-utils/token-factory";

const setup = async ({ accessToken }: { accessToken?: string } = {}) => {
  const user = userEvent.setup();
  const token =
    accessToken ?? (await generateTestToken({ account_type: "student" }));

  render(
    <Providers accessToken={token}>
      <GradesPage />
    </Providers>,
  );

  return { user };
};

const findGradesList = async () =>
  screen.findByRole("region", { name: /lista przedmiotów/i });

const formatAverage = (courses: typeof mockCourses) => {
  const { total, ects } = courses.reduce(
    (accumulator, course) => {
      const grade = course.grades.find((g) => g.counts_into_average);
      if (grade != null) {
        accumulator.total += grade.value * course.ects;
        accumulator.ects += course.ects;
      }
      return accumulator;
    },
    { total: 0, ects: 0 },
  );

  return (total / ects).toLocaleString("pl-PL", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
};

describe("GradesPage", () => {
  it("should have restricted gui for guest users", async () => {
    const guestToken = await generateTestToken({ account_type: "guest" });
    await setup({ accessToken: guestToken });

    expect(screen.getByText(/oceny/i)).toBeVisible();
    expect(screen.getByText(/nie jest dostępna/i)).toBeVisible();

    const connectButton = screen.getByRole("button", { name: /zaloguj się/i });
    expect(connectButton).toBeVisible();
  });

  it("should have restricted gui for authenticated users without student number", async () => {
    const tokenWithoutStudentNumber = await generateTestToken({
      student_number: "",
      account_type: "email",
    });

    await setup({ accessToken: tokenWithoutStudentNumber });

    expect(screen.getByText(/oceny/i)).toBeVisible();
    expect(screen.getByText(/nie jest dostępna/i)).toBeVisible();
  });

  it("should show loading state", async () => {
    server.use(
      http.get("*/grades/", async () => {
        await delay(200);
        return HttpResponse.json({ terms: [], courses: [] });
      }),
    );
    await setup();

    expect(
      await screen.findByRole("status", { name: /ładowanie ocen/i }),
    ).toBeVisible();
    await waitForElementToBeRemoved(() =>
      screen.queryByRole("status", { name: /ładowanie ocen/i }),
    );
  });

  it("should display fetched terms and courses", async () => {
    await setup();

    expect(await screen.findByRole("combobox")).toBeVisible();

    expect(await screen.findByRole("combobox")).toHaveTextContent(
      mockTerms[1].name,
    );

    const gradesList = await findGradesList();
    expect(
      await within(gradesList).findByText(mockCourses[2].course_name),
    ).toBeVisible();
  });

  it("should show error if api request fails", async () => {
    server.use(http.get("*/grades/", () => HttpResponse.error()));
    await setup();

    expect(await screen.findByText(/błąd/i)).toBeVisible();
  });

  it("should correctly calculate average grade", async () => {
    server.use(
      http.get("*/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: mockCourses,
        }),
      ),
    );
    await setup();

    const gradesList = await findGradesList();
    expect(await within(gradesList).findByText("Matematyka")).toBeVisible();
    expect(await within(gradesList).findByText("Informatyka")).toBeVisible();

    expect(
      screen.getByText(
        formatAverage(mockCourses.filter((c) => c.term_id === "term1")),
      ),
    ).toBeVisible();
  });

  it("should handle empty terms and courses", async () => {
    server.use(
      http.get("*/grades/", () =>
        HttpResponse.json({
          terms: [],
          courses: [],
        }),
      ),
    );
    await setup();

    expect(screen.queryByText(/błąd/i)).not.toBeInTheDocument();
    expect(await screen.findByText("Twoje oceny i średnia")).toBeVisible();
    expect(
      await screen.findByText(/brak przedmiotów w tym semestrze/i),
    ).toBeVisible();
  });

  it("should handle course with no grades", async () => {
    server.use(
      http.get("*/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: [emptyCourse],
        }),
      ),
    );
    await setup();

    const gradesList = await findGradesList();
    expect(
      await within(gradesList).findByText(emptyCourse.course_name),
    ).toBeVisible();
    expect(within(gradesList).getAllByText("-").length).toBeGreaterThan(0);
  });

  it("should allow simulating course without initial grades", async () => {
    server.use(
      http.get("*/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: [emptyCourse],
        }),
      ),
    );
    const { user } = await setup();

    const gradesList = await findGradesList();
    expect(
      await within(gradesList).findByText(emptyCourse.course_name),
    ).toBeVisible();

    const simulator = screen.getByRole("region", {
      name: /symulator średniej/i,
    });
    await user.click(within(simulator).getByRole("button", { name: "4,0" }));
    expect(within(simulator).getByText("4,00")).toBeVisible();
  });

  it("should update courses when switching terms", async () => {
    server.use(
      http.get("*/grades/", () =>
        HttpResponse.json({
          terms: mockTerms,
          courses: mockCourses,
        }),
      ),
    );
    const { user } = await setup();

    const gradesList = await findGradesList();
    expect(
      await within(gradesList).findByText(mockCourses[2].course_name),
    ).toBeVisible();

    const termSelect = screen.getByRole("combobox");
    await user.click(termSelect);
    await user.click(
      await screen.findByRole("option", { name: /semestr zimowy 2024\/25/i }),
    );

    expect(
      await within(gradesList).findByText(mockCourses[0].course_name),
    ).toBeVisible();
    expect(
      await within(gradesList).findByText(mockCourses[1].course_name),
    ).toBeVisible();
    expect(
      within(gradesList).queryByText(mockCourses[2].course_name),
    ).not.toBeInTheDocument();
  });
});
