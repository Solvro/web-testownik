import { expect, test, type Page } from "@playwright/test";

const quiz = "11111111-1111-4111-8111-111111111111";
const question = "22222222-2222-4222-8222-222222222222";
const owner = "new-conversation-qa";
const chatKey = `testownik.v1.chat.${owner}.${quiz}`;
const draftKey = `testownik.v1.chat-draft.${owner}.${quiz}.${question}`;
const draft = "Keep this unsent text when starting over";

async function fixture(page: Page) {
  await page.addInitScript(
    ({ owner, quiz, question, chatKey }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", '"en"');
      if (!localStorage.getItem("qa.new-conversation.seeded")) {
        localStorage.setItem("qa.new-conversation.seeded", "true");
        localStorage.setItem(
          chatKey,
          JSON.stringify([
            {
              id: "old-user-message",
              role: "user",
              questionId: question,
              parts: [{ type: "text", text: "Previous conversation question" }],
            },
          ]),
        );
      }
      const control = window as typeof window & { draftWrites?: number };
      control.draftWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          sessionStorage.getItem("qa.fail-new-conversation-draft") === "true" &&
          key.startsWith(`testownik.v1.chat-draft.${owner}.${quiz}.`)
        )
          throw new DOMException(
            "Synthetic quota failure",
            "QuotaExceededError",
          );
        if (key.startsWith(`testownik.v1.chat-draft.${owner}.${quiz}.`))
          control.draftWrites = (control.draftWrites ?? 0) + 1;
        return original.call(this, key, value);
      };
    },
    { owner, quiz, question, chatKey },
  );
  let aiRequests = 0;
  await page.route("**/ai/chat", (route) => {
    aiRequests++;
    return route.abort();
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? {
            id: owner,
            full_name: "Disposable Conversation QA",
            is_guest: false,
          }
        : path.includes(`/quizzes/${quiz}/`)
          ? {
              id: quiz,
              title: "Disposable conversation quiz",
              questions: [
                {
                  id: question,
                  text: "Plain QA question",
                  answers: [],
                  multiple: false,
                },
              ],
            }
          : path.endsWith("/ai/models/")
            ? { models: [], default_model: null }
            : [],
    });
  });
  await page.goto(`/ai?id=${quiz}&question=${question}`);
  await expect(page.getByTestId("assistant-composer")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "New Conversation", exact: true }),
  ).toBeEnabled();
  return () => aiRequests;
}

async function holdDraftLock(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((held) => {
      void navigator.locks.request("testownik.account-data.v1", async () => {
        held();
        await new Promise<void>((release) => {
          (
            window as typeof window & { releaseDraftLock?: () => void }
          ).releaseDraftLock = release;
        });
      });
    });
  });
}
async function releaseDraftLock(page: Page) {
  await page.evaluate(() => {
    (
      window as typeof window & { releaseDraftLock?: () => void }
    ).releaseDraftLock?.();
  });
}

test("completed New Conversation saves the retained draft before its debounce", async ({
  page,
}) => {
  const requests = await fixture(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const composer = page.getByTestId("assistant-composer");
  await composer.fill(draft);
  await page
    .getByRole("button", { name: "New Conversation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "How Can I Help?", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBe(JSON.stringify(draft));
  expect(
    await page.evaluate((key) => localStorage.getItem(key), chatKey),
  ).toBeNull();
  await page.clock.resume();
  await page.reload();
  await expect(composer).toHaveValue(draft);
  expect(requests()).toBe(0);
});

test("failed New Conversation draft save preserves the current thread and retries without AI", async ({
  page,
}) => {
  const requests = await fixture(page);
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    chatKey,
  );
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.accept();
  });
  await page.evaluate(() =>
    sessionStorage.setItem("qa.fail-new-conversation-draft", "true"),
  );
  await page.getByTestId("assistant-composer").fill(draft);
  const start = page.getByRole("button", {
    name: "New Conversation",
    exact: true,
  });
  await start.click();
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toContain("Couldn’t Start New Conversation");
  expect(await page.evaluate((key) => localStorage.getItem(key), chatKey)).toBe(
    before,
  );
  await expect(page.getByTestId("assistant-composer")).toHaveValue(draft);
  await expect(start).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Try Again", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    sessionStorage.removeItem("qa.fail-new-conversation-draft"),
  );
  await start.click();
  await expect(
    page.getByRole("heading", { name: "How Can I Help?", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBe(JSON.stringify(draft));
  expect(requests()).toBe(0);
});

for (const outcome of ["finish", "sign-out"] as const) {
  test(`pending New Conversation excludes duplicate actions and handles ${outcome}`, async ({
    page,
  }) => {
    const requests = await fixture(page);
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      chatKey,
    );
    const alerts: string[] = [];
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "alert") alerts.push(dialog.message());
      await dialog.accept();
    });
    await holdDraftLock(page);
    try {
      const composer = page.getByTestId("assistant-composer");
      await composer.fill(draft);
      const start = page.getByRole("button", {
        name: "New Conversation",
        exact: true,
      });
      await expect(
        page.getByRole("button", { name: "Send message", exact: true }),
      ).toBeEnabled();
      await start.evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });
      await expect(start).toBeDisabled();
      await expect(composer).not.toBeEditable();
      for (const name of ["Send message", "AI Model", "Previous Conversations"])
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeDisabled();
      expect(
        await page.evaluate((key) => localStorage.getItem(key), chatKey),
      ).toBe(before);
      if (outcome === "sign-out") {
        await page.evaluate(() => {
          history.pushState({}, "", "/profile");
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
        await page
          .getByRole("button", { name: "Sign Out", exact: true })
          .click();
        await expect
          .poll(() =>
            page.evaluate(() =>
              sessionStorage.getItem("testownik.oauth-session.v2"),
            ),
          )
          .toBeNull();
        await releaseDraftLock(page);
        // Drain the queued local save and let its cancellation continuation run.
        await page.evaluate(async () => {
          await navigator.locks.request("testownik.account-data.v1", () => {});
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
        await expect(
          page.getByRole("button", {
            name: "Sign in to Testownik",
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate((key) => localStorage.getItem(key), chatKey),
        ).toBe(before);
      } else {
        await releaseDraftLock(page);
        // Programmatic rapid taps keep the composer focused, which intentionally
        // hides the welcome heading. The removed thread action/cache prove ACK.
        await expect(start).toHaveCount(0);
        expect(
          await page.evaluate((key) => localStorage.getItem(key), chatKey),
        ).toBeNull();
        expect(
          await page.evaluate((key) => localStorage.getItem(key), draftKey),
        ).toBe(JSON.stringify(draft));
        await expect(composer).toBeEditable();
        await expect(composer).toHaveValue(draft);
      }
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { draftWrites?: number }).draftWrites,
        ),
      ).toBe(1);
      expect(alerts).toEqual([]);
      expect(requests()).toBe(0);
    } finally {
      await releaseDraftLock(page);
    }
  });
}
