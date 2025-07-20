import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "../tests/Providers";
import { mockQuiz } from "../tests/mocks/QuizMock";
import ImportQuizPage from "./ImportQuizPage";
import { http, HttpResponse } from "msw";
import { server } from "../tests/mocks/server";

vi.mock("../components/quiz/helpers/quizValidation.ts", () => ({
  validateQuiz: vi.fn(() => null),
}));
vi.mock("../components/quiz/helpers/uuid.ts", () => ({
  uuidv4: vi.fn(() => "mocked-uuid"),
}));

const setup = (guest = false) => {
  const user = userEvent.setup();

  render(
    <Providers guest={guest}>
      <ImportQuizPage />
    </Providers>
  );

  const switchToJson = async () => {
    await user.click(screen.getByRole("button", { name: /tekst/i }));
  };

  const switchToFile = async () => {
    await user.click(screen.getByRole("button", { name: /plik/i }));
  };

  const clickImport = async () => {
    await user.click(screen.getByRole("button", { name: /zaimportuj/i }));
  };

  const input = (text: string) => {
    // using fire event to not trigger json parsing errors
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: text },
    });
  };

  const importFile = async (content: string, name: string) => {
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File([content], name, { type: "application/json" });
    await user.upload(fileInput, file);
    return file;
  };

  return { user, switchToFile, switchToJson, clickImport, input, importFile };
};

describe("QuizImportPage", () => {
  describe("link import", () => {
    it("should show error for invalid link", async () => {
      const { clickImport, input } = setup();

      input("invalid-link");
      await clickImport();

      expect(screen.getByText(/link.*niepoprawny/i)).toBeInTheDocument();
    });

    it("should submit valid link", async () => {
      const { clickImport, input } = setup();

      input("https://valid.com");
      await clickImport();

      expect(screen.getByText(mockQuiz.title)).toBeInTheDocument();
    });
  });

  describe("json import", () => {
    it("should show error if invalid json", async () => {
      const { clickImport, input, switchToJson } = setup();

      await switchToJson();
      input("{ invalid json");
      await clickImport();

      expect(screen.getByText(/błąd.*JSON/i)).toBeInTheDocument();
    });

    it("should submit valid JSON", async () => {
      const { clickImport, input, switchToJson } = setup();

      await switchToJson();
      input(JSON.stringify(mockQuiz));
      await clickImport();

      expect(screen.getByText(mockQuiz.title)).toBeInTheDocument();
    });
  });

  describe("file import", () => {
    it("should show error if no file is selected", async () => {
      const { switchToFile, clickImport } = setup();

      await switchToFile();
      await clickImport();

      expect(screen.getByText(/wybierz plik z quizem/i)).toBeInTheDocument();
    });

    it("should show error when uploading file with invalid json", async () => {
      const { switchToFile, clickImport, importFile } = setup();

      await switchToFile();
      await importFile("{ invalid json", "valid.json");
      await clickImport();

      await waitFor(() => {
        expect(screen.getByText(/wystąpił błąd.*plik/i)).toBeInTheDocument();
      });
    });

    it("should accept valid file", async () => {
      const { switchToFile, clickImport, importFile } = setup();

      await switchToFile();
      await importFile(JSON.stringify(mockQuiz), "valid.json");
      await clickImport();

      await waitFor(() => {
        expect(screen.getByText(mockQuiz.title)).toBeInTheDocument();
      });
    });
  });

  it("should show error on API error", async () => {
    server.use(
      http.post("/import-quiz-from-link/", () =>
        HttpResponse.json({ error: "Something went wrong" }, { status: 500 })
      )
    );
    const { clickImport, input } = setup();

    input("https://valid.com");
    await clickImport();

    expect(screen.getByText(/wystąpił błąd/i)).toBeInTheDocument();
  });
});
