import {
  render,
  screen,
  waitForElementToBeRemoved,
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
import { calculateAverageGrade } from "@/test-utils/mocks/helpers";
import { server } from "@/test-utils/mocks/server";
import { Providers } from "@/test-utils/providers";
import { generateTestToken } from "@/test-utils/token-factory";

const setup = async ({
  asGuest: guest = false,
  accessToken,
}: { asGuest?: boolean; accessToken?: string } = {}) => {
  const user = userEvent.setup();
  const token = accessToken ?? (await generateTestToken());

  render(
    <Providers guest={guest} accessToken={token}>
      <GradesPage />
    </Providers>,
  );

  return { user };
};

describe("GradesPage", () => {
  it("should have restricted gui for guest users", async () => {
    await setup({ asGuest: true });

    expect(screen.getByText(/oceny/i)).toBeVisible();
    expect(
      screen.getByText(/nie jest dostępna w trybie gościa/i),
    ).toBeVisible();

    const connectButton = screen.getByRole("button", { name: /połącz konto/i });
    expect(connectButton).toBeVisible();
  });

  it("should have restricted gui for authenticated users without student number", async () => {
    const tokenWithoutStudentNumber = await generateTestToken({
      student_number: "",
    });

    await setup({ accessToken: tokenWithoutStudentNumber });

    expect(screen.getByText(/oceny/i)).toBeVisible();
    expect(
      screen.getByText(/nie jest dostępna dla kont Solvro Auth/i),
    ).toBeVisible();
  });

  it("should show loading spinner", async () => {
    server.use(
      http.get("*/grades/", async () => {
        await delay(200);
        return HttpResponse.json({});
      }),
    );
    await setup();

    expect(await screen.findByText(/ładowanie/i)).toBeVisible();
    await waitForElementToBeRemoved(() => screen.queryByText(/ładowanie/i));
  });

  it("should display fetched terms and courses", async () => {
    await setup();

    expect(await screen.findByRole("combobox")).toBeVisible();

    expect(await screen.findByRole("combobox")).toHaveTextContent(
      mockTerms[1].name,
    );

    expect(screen.getByText(mockCourses[2].course_name)).toBeVisible();
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

    expect(await screen.findByText("Matematyka")).toBeVisible();
    expect(await screen.findByText("Informatyka")).toBeVisible();

    expect(
      screen.getByText(
        calculateAverageGrade(mockCourses.filter((c) => c.term_id === "term1")),
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
    expect(screen.getByText("Oceny")).toBeVisible();
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

    expect(await screen.findByText(emptyCourse.course_name)).toBeVisible();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("should allow editing course without initial grades", async () => {
    server.use(
      http.get("*/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: [emptyCourse],
        }),
      ),
    );
    const { user } = await setup();

    expect(await screen.findByText(emptyCourse.course_name)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /tryb edycji/i }));
    const gradeInput = screen.getByDisplayValue("");
    await user.type(gradeInput, "4.0");
    expect(gradeInput).toHaveValue(4);
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

    expect(await screen.findByText(mockCourses[2].course_name)).toBeVisible();

    const termSelect = screen.getByRole("combobox");
    await user.click(termSelect);
    await user.click(screen.getByRole("option", { name: mockTerms[0].name }));

    expect(await screen.findByText(mockCourses[0].course_name)).toBeVisible();
    expect(await screen.findByText(mockCourses[1].course_name)).toBeVisible();
  });
});
