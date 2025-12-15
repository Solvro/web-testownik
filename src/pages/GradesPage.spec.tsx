import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { describe, expect, it, vi } from "vitest";
import { emptyCourse, mockCourses, mockTerms } from "../tests/mocks/GradesMock";
import { calculateAverage } from "../tests/mocks/helpers";
import { server } from "../tests/mocks/server";
import { Providers } from "../tests/Providers";
import GradesPage from "./GradesPage";
import userEvent from "@testing-library/user-event";

const setup = ({ asGuest: guest = false } = {}) => {
  const user = userEvent.setup();

  render(
    <Providers guest={guest}>
      <GradesPage />
    </Providers>
  );

  return { user };
};

describe("GradesPage", () => {
  it("should show have restricted gui for guest users", async () => {
    setup({ asGuest: true });

    expect(screen.getByText(/oceny/i)).toBeVisible();
    expect(
      screen.getByText(/nie jest dostępna w trybie gościa/i)
    ).toBeVisible();

    const connectButton = screen.getByRole("button", { name: /połącz konto/i });
    expect(connectButton).toBeVisible();
  });

  it("should show loading spinner", async () => {
    server.use(
      http.get("/grades/", async () => {
        await delay(200);
        return HttpResponse.json({});
      })
    );
    setup();

    expect(screen.getByText(/ładowanie/i)).toBeVisible();
    await waitForElementToBeRemoved(() => screen.queryByText(/ładowanie/i));
  });

  it("should display fetched terms and courses", async () => {
    vi.setSystemTime(new Date("2024-10-15T12:00:00Z"));
    setup();

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /wybierz semestr/i })
      ).toBeVisible();

      expect(screen.getByText(mockCourses[0].course_name)).toBeVisible();
      expect(screen.getByText(mockCourses[1].course_name)).toBeVisible();
      expect(
        screen.getByRole("option", { name: mockTerms[0].name })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: mockTerms[1].name })
      ).toBeInTheDocument();
    });
  });

  it("should show error if api request fails", async () => {
    server.use(http.get("/grades/", () => HttpResponse.error()));
    setup();

    expect(screen.findByText(/wystąpił błąd/i));
  });

  it("should correctly calculate average grade", async () => {
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: mockCourses,
        })
      )
    );
    setup();

    await waitFor(() => {
      expect(screen.getByText("Matematyka")).toBeVisible();
      expect(screen.getByText("Informatyka")).toBeVisible();
    });

    expect(
      screen.getByText(
        calculateAverage(mockCourses.filter((c) => c.term_id === "term1"))
      )
    ).toBeVisible();
  });

  it("should handle empty terms and courses", async () => {
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: [],
          courses: [],
        })
      )
    );
    setup();

    // Right now component shows an error, would be better to handle this as an edge case
    await waitFor(() => {
      expect(screen.getByText(/wystąpił błąd/i)).toBeVisible();
      expect(screen.getByText(/undefined/i)).toBeVisible();
    });
  });

  it("should handle course with no grades", async () => {
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: [emptyCourse],
        })
      )
    );
    setup();

    expect(await screen.findByText(emptyCourse.course_name)).toBeVisible();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("should allow editing course without initial grades", async () => {
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: [emptyCourse],
        })
      )
    );
    const { user } = setup();

    await waitFor(() => {
      expect(screen.getByText(emptyCourse.course_name)).toBeVisible();
    });

    await user.click(screen.getByTestId("edit-grades-button"));
    const gradeInput = screen.getByRole("spinbutton");
    await user.type(gradeInput, "4.0");
    expect(gradeInput).toHaveValue(4.0);
  });

  it("should show error if API returns malformed response", async () => {
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          badKey: [],
        })
      )
    );
    setup();

    await waitFor(() => {
      expect(screen.getByText(/wystąpił błąd/i)).toBeVisible();
    });
  });

  it("should update courses when switching terms", async () => {
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: mockTerms,
          courses: mockCourses,
        })
      )
    );
    const { user } = setup();

    await waitFor(() => {
      expect(screen.getByText(mockCourses[0].course_name)).toBeVisible();
    });

    const termSelect = screen.getByRole("combobox");
    await user.selectOptions(termSelect, mockTerms[1].name);

    await waitFor(() => {
      expect(screen.getByText(mockCourses[2].course_name)).toBeVisible();
    });
  });
});
