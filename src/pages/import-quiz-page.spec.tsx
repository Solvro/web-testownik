import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { mockQuiz } from "../tests/mocks/quiz-mock";
import { server } from "../tests/mocks/server";
import { Providers } from "../tests/providers";
import { ImportQuizPage } from "./import-quiz-page";

const setup = ({ asGuest = false } = {}) => {
  const user = userEvent.setup();

  render(
    <Providers guest={asGuest}>
      <ImportQuizPage />
    </Providers>,
  );

  const switchToJson = async () => {
    await user.click(screen.getByRole("tab", { name: /tekst/i }));
  };

  const switchToFile = async () => {
    await user.click(screen.getByRole("tab", { name: /^plik$/i }));
  };

  const clickImport = async () => {
    await user.click(screen.getByRole("button", { name: /importuj/i }));
  };

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const inputJson = (text: string) => {
    fireEvent.change(screen.getByLabelText(/json/i), {
      target: { value: text },
    });
  };

  const uploadJsonFile = async (content: string, name: string) => {
    const fileInput = screen.getByLabelText(/plik/i);
    const file = new File([content], name, { type: "application/json" });
    await user.upload(fileInput, file);
  };

  return {
    user,
    switchToFile,
    switchToJson,
    clickImport,
    inputJson,
    uploadJsonFile,
  };
};

describe("ImportQuizPage", () => {
  describe("json import", () => {
    it("should show error if invalid json", async () => {
      const { clickImport, inputJson, switchToJson } = setup();

      await switchToJson();
      inputJson("{ invalid json");
      await clickImport();

      expect(await screen.findByText(/błąd.*json/i)).toBeVisible();
    });

    it("should submit valid JSON", async () => {
      const { clickImport, inputJson, switchToJson } = setup();

      await switchToJson();
      inputJson(JSON.stringify(mockQuiz));
      await clickImport();

      expect(
        await screen.findByRole("heading", {
          name: new RegExp(
            `quiz\\s+"${mockQuiz.title}"\\s+został\\s+zaimportowany`,
            "i",
          ),
        }),
      ).toBeVisible();
    });

    it("should show error if text input is empty", async () => {
      const { clickImport, switchToJson } = setup();

      await switchToJson();
      await clickImport();

      expect(await screen.findByText(/wklej quiz/i)).toBeVisible();
    });
  });

  describe("file import", () => {
    it("should show error if no file is selected", async () => {
      const { switchToFile, clickImport } = setup();

      await switchToFile();
      await clickImport();

      expect(screen.getByText(/wybierz plik z quizem/i)).toBeVisible();
    });

    it("should show error when uploading file with invalid json", async () => {
      const { switchToFile, clickImport, uploadJsonFile } = setup();

      await switchToFile();
      await uploadJsonFile("{ invalid json", "invalid.json");
      await clickImport();

      expect(await screen.findByText(/błąd.*plik/i)).toBeVisible();
    });

    it("should accept valid file", async () => {
      const { switchToFile, clickImport, uploadJsonFile } = setup();

      await switchToFile();
      await uploadJsonFile(JSON.stringify(mockQuiz), "valid.json");
      await clickImport();

      expect(
        await screen.findByRole("heading", {
          name: new RegExp(
            `quiz\\s+"${mockQuiz.title}"\\s+został\\s+zaimportowany`,
            "i",
          ),
        }),
      ).toBeVisible();
    });
  });

  it("should show error on API error", async () => {
    server.use(http.post("*/quizzes/", () => HttpResponse.error()));
    const { clickImport, inputJson, switchToJson } = setup();

    await switchToJson();
    inputJson(JSON.stringify(mockQuiz));
    await clickImport();

    expect(
      await screen.findByText(/wystąpił błąd podczas importowania quizu/i),
    ).toBeVisible();
  });
});
