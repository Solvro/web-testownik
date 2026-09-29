import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: editor validates the offending question and preserves a bilingual draft`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "editor-fixture-token",
          refresh: "editor-fixture-refresh",
        }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    const writes: string[] = [];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes.push(path);
      await route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "editor-fixture", username: "Fixture", is_guest: false }
          : [],
      });
    });
    const copy =
      language === "en"
        ? {
            title: "Quiz title",
            question: "Question text",
            answer: "Answer",
            save: "Save Quiz",
            add: "Add Question",
            previous: "Previous Question",
            titleError: "Enter a quiz title.",
            questionError: "Question 2: Add question text or an image.",
            heading: "Question 2 of 2",
          }
        : {
            title: "Tytuł quizu",
            question: "Treść pytania",
            answer: "Odpowiedź",
            save: "Zapisz quiz",
            add: "Dodaj pytanie",
            previous: "Poprzednie pytanie",
            titleError: "Tytuł quizu jest wymagany",
            questionError: "Pytanie 2: Pytanie musi zawierać tekst lub zdjęcie",
            heading: "Pytanie 2 z 2",
          };
    await page.goto("/editor");
    await page.getByRole("button", { name: copy.save, exact: true }).click();
    await expect(
      page.getByText(copy.titleError, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: copy.title, exact: true })
      .fill("Mobile — Żółć");
    await page
      .getByRole("textbox", { name: copy.question, exact: true })
      .fill("First question");
    for (let i = 1; i <= 2; i++)
      await page
        .getByRole("textbox", { name: `${copy.answer} ${i}`, exact: true })
        .fill(`Answer ${i}`);
    await page.getByRole("button", { name: copy.add, exact: true }).click();
    for (let i = 1; i <= 2; i++)
      await page
        .getByRole("textbox", { name: `${copy.answer} ${i}`, exact: true })
        .fill(`Second answer ${i}`);
    await page
      .getByRole("button", { name: copy.previous, exact: true })
      .click();
    await page.getByRole("button", { name: copy.save, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: copy.heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(copy.questionError, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: copy.question, exact: true })
      .fill("Second question");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem("testownik.v1.draft.editor-fixture.new") ??
                "null",
            )?.questions[1]?.text,
        ),
      )
      .toBe("Second question");
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: copy.title, exact: true }),
    ).toHaveValue("Mobile — Żółć");
    expect(writes.filter((path) => path.includes("/quizzes/"))).toEqual([]);
  });
}

test("server retry and failed draft cleanup never repeat a committed save", async ({
  page,
}) => {
  const quizId = "44444444-4444-4444-8444-444444444444";
  const draft = {
    title: "Save recovery",
    description: "",
    questions: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        order: 0,
        text: "Question",
        multiple: false,
        image: "https://example.com/readonly.png",
        image_width: 200,
        answers: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            order: 0,
            text: "Answer",
            is_correct: true,
            image: "https://example.com/answer.png",
            image_height: 100,
          },
        ],
      },
    ],
  };
  await page.addInitScript((draft) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "editor-fixture-token",
        refresh: "editor-fixture-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.draft.editor-fixture.new",
      JSON.stringify(draft),
    );
    const original = Storage.prototype.removeItem;
    let fail = true;
    Storage.prototype.removeItem = function (key) {
      if (key === "testownik.v1.draft.editor-fixture.new" && fail) {
        fail = false;
        throw new Error("Fixture storage unavailable");
      }
      original.call(this, key);
    };
  }, draft);
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      await route.fulfill(
        writes.length === 1
          ? { status: 503, json: { detail: "Fixture unavailable" } }
          : { json: { ...draft, id: quizId } },
      );
    } else
      await route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "editor-fixture", username: "Fixture", is_guest: false }
          : path.includes(quizId)
            ? { ...draft, id: quizId }
            : [],
      });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/editor");
  const save = page.getByRole("button", { name: "Save Quiz", exact: true });
  await save.click();
  await expect(save).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue(draft.title);
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Quiz Saved", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your quiz is saved. Could not remove the local draft. Retry to finish cleaning it up.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({
    title: draft.title,
    description: "",
    questions: [
      {
        id: draft.questions[0].id,
        order: 1,
        text: "Question",
        multiple: false,
        answers: [
          {
            id: draft.questions[0].answers[0].id,
            order: 0,
            text: "Answer",
            is_correct: true,
          },
        ],
      },
    ],
  });
  await page
    .getByRole("button", { name: "Clear Saved Draft", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(writes).toHaveLength(2);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("testownik.v1.draft.editor-fixture.new"),
    ),
  ).toBeNull();
});

test("attached images preview and removal is sent explicitly for question and answer", async ({
  page,
}) => {
  const id = "77777777-7777-4777-8777-777777777777";
  const quiz = {
    id,
    title: "Image editing",
    description: "",
    questions: [
      {
        id: "question-image",
        text: "Question",
        order: 1,
        multiple: false,
        image: "http://localhost:8081/fixture/question.svg",
        image_upload: "question-upload",
        answers: [
          {
            id: "answer-image",
            text: "Answer",
            order: 1,
            is_correct: true,
            image: "http://localhost:8081/fixture/answer.svg",
            image_upload: "answer-upload",
          },
        ],
      },
    ],
  };
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "editor-fixture-token",
        refresh: "editor-fixture-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  await page.route("**/fixture/*.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#5475c0"/></svg>',
    }),
  );
  let payload:
    | {
        questions: {
          image_upload: unknown;
          image_url: unknown;
          answers: { image_upload: unknown; image_url: unknown }[];
        }[];
      }
    | undefined;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "PATCH" && path.includes(id))
      payload = route.request().postDataJSON();
    await route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "editor-fixture", username: "Fixture", is_guest: false }
        : path.includes(id)
          ? quiz
          : [],
    });
  });
  await page.goto(`/editor?id=${id}`);
  const questionImage = page.getByRole("img", {
    name: "Question image",
    exact: true,
  });
  const answerImage = page.getByRole("img", {
    name: "Answer 1 image",
    exact: true,
  });
  await expect(questionImage).toBeVisible();
  await expect(answerImage).toBeAttached();
  await page
    .getByRole("button", { name: "Remove Image", exact: true })
    .first()
    .click();
  await expect(questionImage).toHaveCount(0);
  await expect(answerImage).toBeAttached();
  await page.getByRole("button", { name: "Remove Image", exact: true }).click();
  await expect(answerImage).toHaveCount(0);
  await page.getByRole("button", { name: "Save Quiz", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${id}`));
  expect(payload?.questions[0]).toMatchObject({
    image_upload: null,
    image_url: null,
  });
  expect(payload?.questions[0].answers[0]).toMatchObject({
    image_upload: null,
    image_url: null,
  });
  expect(payload?.questions[0]).not.toHaveProperty("image");
});

test("pending upload disables save and attaches to the original question after navigation", async ({
  page,
}) => {
  const draft = {
    title: "Upload navigation",
    description: "",
    questions: [1, 2].map((n) => ({
      id: `question-${n}`,
      order: n,
      text: `Question ${n}`,
      multiple: false,
      answers: [
        { id: `answer-${n}`, order: 1, text: "Answer", is_correct: true },
      ],
    })),
  };
  await page.addInitScript((draft) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "editor-fixture-token",
        refresh: "editor-fixture-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.draft.editor-fixture.new",
      JSON.stringify(draft),
    );
  }, draft);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploaded = false;
  await page.route("**/fixture/upload.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="blue"/></svg>',
    }),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/upload/")) {
      uploaded = true;
      await gate;
      await route.fulfill({
        status: 201,
        json: {
          id: "uploaded-question",
          url: "http://localhost:8081/fixture/upload.svg",
          width: 32,
          height: 24,
        },
      });
    } else
      await route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "editor-fixture", username: "Fixture", is_guest: false }
          : [],
      });
  });
  await page.goto("/editor");
  await page
    .getByRole("button", { name: "Question options", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Add Question Image", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2u0AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect.poll(() => uploaded).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Save Quiz", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Next Question", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("button", { name: "Save Quiz", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("img", { name: "Question image", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Previous Question", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Question image", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("testownik.v1.draft.editor-fixture.new") ??
              "null",
          )?.questions[0]?.image_upload,
      ),
    )
    .toBe("uploaded-question");
});

test("question overview jumps, reorders, and preserves the draft after reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "editor-fixture-token",
        refresh: "editor-fixture-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    if (!localStorage.getItem("testownik.v1.draft.editor-overview.new"))
      localStorage.setItem(
        "testownik.v1.draft.editor-overview.new",
        JSON.stringify({
          title: "Overview fixture",
          description: "",
          questions: ["Alpha", "Beta", "Gamma"].map((text, i) => ({
            id: text,
            text,
            order: i + 1,
            multiple: false,
            answers: [
              { id: `${text}-a`, text: "Yes", order: 1, is_correct: true },
              { id: `${text}-b`, text: "No", order: 2, is_correct: false },
            ],
          })),
        }),
      );
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "editor-overview", username: "Fixture", is_guest: false }
        : [],
    }),
  );
  await page.goto("/editor");
  await page
    .getByRole("button", { name: "Question 1 of 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Question 3 Gamma", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Question text", exact: true }),
  ).toHaveValue("Gamma");
  await page
    .getByRole("button", { name: "Question 3 of 3", exact: true })
    .click();
  await page.getByRole("button", { name: "Reorder", exact: true }).click();
  await page
    .getByRole("button", { name: "Move up: Question 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move up: Question 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Question text", exact: true }),
  ).toHaveValue("Gamma");
  await expect(
    page.getByRole("button", { name: "Question 1 of 3", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("testownik.v1.draft.editor-overview.new")!,
        ).questions.map((q: { id: string }) => q.id),
      ),
    )
    .toEqual(["Gamma", "Alpha", "Beta"]);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Question text", exact: true }),
  ).toHaveValue("Gamma");
});
