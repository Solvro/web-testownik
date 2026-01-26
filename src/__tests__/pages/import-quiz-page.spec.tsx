import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { ImportQuizPageClient as ImportQuizPage } from "@/app/import-quiz/client";
import { mockLegacyQuiz, mockQuiz } from "@/test-utils/mocks/quiz-mock";
import { server } from "@/test-utils/mocks/server";
import { Providers } from "@/test-utils/providers";
import { generateTestToken } from "@/test-utils/token-factory";

const setup = async ({ asGuest = false } = {}) => {
  const user = userEvent.setup();
  const token = await generateTestToken();

  render(
    <Providers guest={asGuest} accessToken={token}>
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
    const fileInput = screen.getByLabelText(/Plik JSON z quizem/i);
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
      const { clickImport, inputJson, switchToJson } = await setup();

      await switchToJson();
      inputJson("{ invalid json");
      await clickImport();

      expect(
        await screen.findByText(/Wystąpił błąd podczas parsowania JSON/i),
      ).toBeVisible();
    });

    it("should submit valid JSON", async () => {
      const { clickImport, inputJson, switchToJson } = await setup();

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
      const { clickImport, switchToJson } = await setup();

      await switchToJson();
      await clickImport();

      expect(await screen.findByText(/wklej quiz/i)).toBeVisible();
    });

    it("should submit valid legacy JSON", async () => {
      const { clickImport, inputJson, switchToJson } = await setup();

      await switchToJson();
      inputJson(JSON.stringify(mockLegacyQuiz));
      await clickImport();

      expect(
        await screen.findByRole("heading", {
          name: new RegExp(
            `quiz\\s+"${mockLegacyQuiz.title}"\\s+został\\s+zaimportowany`,
            "i",
          ),
        }),
      ).toBeVisible();
    });
    it("should correctly handle image_url and image fields preservation", async () => {
      let capturedBody:
        | {
            questions: {
              image_url?: string;
              answers: { image_url?: string }[];
            }[];
          }
        | undefined;
      server.use(
        http.post("*/quizzes/", async ({ request }) => {
          const body = (await request.json()) as {
            questions: {
              image_url?: string;
              answers: { image_url?: string }[];
            }[];
          };
          capturedBody = body;
          return HttpResponse.json({
            id: "new-id",
            ...body,
          });
        }),
      );

      const { clickImport, inputJson, switchToJson } = await setup();

      const mixedQuiz = {
        title: "Mixed Image Quiz",
        description: "Testing image fields",
        questions: [
          {
            id: "q1",
            text: "Legacy Image",
            image: "legacy.png",
            answers: [
              {
                id: "a1",
                text: "A",
                is_correct: true,
                order: 1,
                image: "legacy_ans.png",
              },
            ],
            order: 1,
            multiple: false,
          },
          {
            id: "q2",
            text: "New Image URL",
            image_url: "new.png",
            answers: [{ id: "a2", text: "A", is_correct: true, order: 1 }],
            order: 2,
            multiple: false,
          },
          {
            id: "q3",
            text: "Both Fields",
            image: "legacy_clobber.png",
            image_url: "correct_url.png",
            answers: [{ id: "a3", text: "A", is_correct: true, order: 1 }],
            order: 3,
            multiple: false,
          },
        ],
      };

      await switchToJson();
      inputJson(JSON.stringify(mixedQuiz));
      await clickImport();

      expect(
        await screen.findByRole("heading", {
          name: /quiz "Mixed Image Quiz" został zaimportowany/i,
        }),
      ).toBeVisible();

      expect(capturedBody).toBeDefined();
      expect(capturedBody?.questions[0].image_url).toBe("legacy.png");
      expect(capturedBody?.questions[0].answers[0].image_url).toBe(
        "legacy_ans.png",
      );
      expect(capturedBody?.questions[1].image_url).toBe("new.png");
      expect(capturedBody?.questions[2].image_url).toBe("correct_url.png");
    });
  });

  describe("file import", () => {
    it("should show error if no file is selected", async () => {
      const { switchToFile, clickImport } = await setup();

      await switchToFile();
      await clickImport();

      expect(screen.getByText(/wybierz plik z quizem/i)).toBeVisible();
    });

    it("should show error when uploading file with invalid json", async () => {
      const { switchToFile, clickImport, uploadJsonFile } = await setup();

      await switchToFile();
      await uploadJsonFile("{ invalid json", "invalid.json");
      await clickImport();

      expect(
        await screen.findByText(/Wystąpił błąd podczas wczytywania pliku/i),
      ).toBeVisible();
    });

    it("should accept valid file", async () => {
      const { switchToFile, clickImport, uploadJsonFile } = await setup();

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

    it("should accept valid legacy file", async () => {
      const { switchToFile, clickImport, uploadJsonFile } = await setup();

      await switchToFile();
      await uploadJsonFile(JSON.stringify(mockLegacyQuiz), "legacy.json");
      await clickImport();

      expect(
        await screen.findByRole("heading", {
          name: new RegExp(
            `quiz\\s+"${mockLegacyQuiz.title}"\\s+został\\s+zaimportowany`,
            "i",
          ),
        }),
      ).toBeVisible();
    });
  });

  it("should show error on API error", async () => {
    server.use(http.post("*/quizzes/", () => HttpResponse.error()));
    const { clickImport, inputJson, switchToJson } = await setup();

    await switchToJson();
    inputJson(JSON.stringify(mockQuiz));
    await clickImport();

    expect(
      await screen.findByText(/wystąpił błąd podczas importowania quizu/i),
    ).toBeVisible();
  });
});
