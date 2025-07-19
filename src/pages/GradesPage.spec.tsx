import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { mockCourses, mockTerms } from "../tests/mocks/GradesMock";
import { server } from "../tests/mocks/server";
import { Providers } from "../tests/Providers";
import GradesPage from "./GradesPage";

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
});
