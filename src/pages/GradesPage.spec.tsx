import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { emptyCourse, mockCourses, mockTerms } from "../tests/mocks/GradesMock";
import { server } from "../tests/mocks/server";
import { Providers } from "../tests/Providers";
import GradesPage from "./GradesPage";
import userEvent from "@testing-library/user-event";

const setup = () => {
  const user = userEvent.setup();

  return { user };
};

describe("GradesPage", () => {
  it("should show have restricted gui for guest users", async () => {
    render(
      <Providers guest>
        <GradesPage />
      </Providers>
    );

    expect(screen.getByText(/oceny/i)).toBeInTheDocument();
    expect(
      screen.getByText(/nie jest dostępna w trybie gościa/i)
    ).toBeInTheDocument();

    const connectButton = screen.getByRole("button", { name: /połącz konto/i });
    expect(connectButton).toBeInTheDocument();
  });

  it("should show loading spinner", async () => {
    server.use(
      http.get(
        "/grades/",
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(HttpResponse.json({})), 200)
          )
      )
    );

    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    expect(screen.getByText(/ładowanie/i)).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.queryByText(/ładowanie/i));
  });

  it("should display fetched terms and courses", async () => {
    vi.setSystemTime(new Date("2024-10-15T12:00:00Z"));

    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /wybierz semestr/i })
      ).toBeInTheDocument();

      expect(screen.getByText(mockCourses[0].course_name)).toBeInTheDocument();
      expect(screen.getByText(mockCourses[1].course_name)).toBeInTheDocument();
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
    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText(/wystąpił błąd/i)).toBeInTheDocument();
    });
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
    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText("Matematyka")).toBeInTheDocument();
      expect(screen.getByText("Informatyka")).toBeInTheDocument();
    });

    expect(screen.getByText("4.55")).toBeInTheDocument();
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
    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    // Right now component shows an error, would be better to handle this as an edge case
    await waitFor(() => {
      expect(screen.getByText(/wystąpił błąd/i)).toBeInTheDocument();
      expect(screen.getByText(/undefined/i)).toBeInTheDocument();
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
    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText(emptyCourse.course_name)).toBeInTheDocument();
      expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    });
  });

  it("should allow editing course without initial grades", async () => {
    const { user } = setup();
    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: [mockTerms[0]],
          courses: [emptyCourse],
        })
      )
    );
    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText(emptyCourse.course_name)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button"));
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
    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText(/wystąpił błąd/i)).toBeInTheDocument();
    });
  });

  it("should update courses when switching terms", async () => {
    const { user } = setup();

    server.use(
      http.get("/grades/", () =>
        HttpResponse.json({
          terms: mockTerms,
          courses: mockCourses,
        })
      )
    );

    render(
      <Providers>
        <GradesPage />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByText(mockCourses[0].course_name)).toBeInTheDocument();
    });

    const termSelect = screen.getByRole("combobox");
    await user.selectOptions(termSelect, mockTerms[1].name)

    await waitFor(() => {
      expect(screen.getByText(mockCourses[2].course_name)).toBeInTheDocument();
    });
  });
});
