import { test, expect } from "@playwright/test";
for (const language of ["en", "pl"] as const)
  test(`${language}: sharing separates access from links and supports role changes`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "sharing-fixture",
          refresh: "sharing-refresh",
        }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    const quiz = {
      id: "share-fixture",
      title: "Sharing fixture",
      can_edit: true,
      visibility: 0,
      allow_anonymous: false,
      is_anonymous: false,
    };
    const person = { id: "recipient", full_name: "Student Fixture" };
    let entries: {
      id: string;
      user: typeof person;
      group: null;
      allow_edit: boolean;
    }[] = [];
    let posts = 0,
      failRole = true;
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname,
        method = request.method();
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "owner", full_name: "Owner", is_guest: false },
        });
      if (path.includes("/quizzes/")) {
        if (method === "PATCH") Object.assign(quiz, request.postDataJSON());
        return route.fulfill({ json: quiz });
      }
      if (path.endsWith("/study-groups/")) return route.fulfill({ json: [] });
      if (path.endsWith("/users/")) return route.fulfill({ json: [person] });
      if (path.includes("/shared-quizzes/")) {
        if (method === "POST") {
          posts++;
          expect(request.postDataJSON()).toMatchObject({
            quiz_id: quiz.id,
            user_id: person.id,
            allow_edit: false,
          });
          entries = [
            { id: "entry", user: person, group: null, allow_edit: false },
          ];
          return route.fulfill({ status: 201, json: entries[0] });
        }
        if (method === "PATCH") {
          if (failRole) {
            failRole = false;
            return route.fulfill({ status: 503, json: {} });
          }
          entries[0].allow_edit = request.postDataJSON().allow_edit;
          return route.fulfill({ json: entries[0] });
        }
        if (method === "DELETE") {
          entries = [];
          return route.fulfill({ status: 204 });
        }
        return route.fulfill({ json: entries });
      }
      return route.fulfill({ json: [] });
    });
    const c =
      language === "en"
        ? {
            invite: "Add People or Groups",
            enable: "Share with Selected People",
            search: "Find a person or group",
            find: "Search",
            add: "Add: Student Fixture",
            added: "Student Fixture — added",
            options: "Access options: Student Fixture",
            edit: "Allow Editing",
            role: "Can edit",
            study: "Can study",
            remove: "Remove Access",
            failed: "Change Not Saved",
          }
        : {
            invite: "Dodaj osoby lub grupy",
            enable: "Udostępnij wybranym osobom",
            search: "Znajdź osobę lub grupę",
            find: "Szukaj",
            add: "Dodaj: Student Fixture",
            added: "Student Fixture — dodano",
            options: "Opcje dostępu: Student Fixture",
            edit: "Zezwól na edycję",
            role: "Może edytować",
            study: "Może się uczyć",
            remove: "Odbierz dostęp",
            failed: "Nie zapisano zmiany",
          };
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`/share?id=${quiz.id}`);
    await page.getByRole("button", { name: c.invite, exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: c.search, exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: c.enable, exact: true }).click();
    const field = page.getByRole("textbox", { name: c.search, exact: true });
    await field.fill("Student");
    await page.getByRole("button", { name: c.find, exact: true }).click();
    await expect(
      page.getByRole("button", { name: c.add, exact: true }),
    ).toBeVisible();
    await field.fill("changed");
    await expect(
      page.getByRole("button", { name: c.add, exact: true }),
    ).toHaveCount(0);
    await field.fill("Student");
    await page.getByRole("button", { name: c.find, exact: true }).click();
    await page.getByRole("button", { name: c.add, exact: true }).click();
    await expect(
      page.getByRole("button", { name: c.added, exact: true }),
    ).toBeDisabled();
    expect(posts).toBe(1);
    await page.getByRole("button", { name: c.options, exact: true }).click();
    await page.getByRole("button", { name: c.edit, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: c.failed, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(c.study, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: c.options, exact: true }).click();
    await page.getByRole("button", { name: c.edit, exact: true }).click();
    await expect(page.getByText(c.role, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: c.options, exact: true }).click();
    await page.getByRole("button", { name: c.remove, exact: true }).click();
    await expect(
      page.getByRole("button", { name: c.options, exact: true }),
    ).toHaveCount(0);
  });

test("connected app permissions are readable and retain unknown grants", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "permissions-fixture",
        refresh: "permissions-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "owner", full_name: "Owner", is_guest: false }
        : [
            {
              client_id: "fixture-app",
              client_name: "Fixture app",
              scopes:
                "quizzes:read quizzes:write future:permission quizzes:read",
            },
          ],
    }),
  );
  await page.goto("/account");
  await expect(page.getByText("Permissions: 3", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Options for Fixture app", exact: true })
    .click();
  const dialog = page.waitForEvent("dialog").then(async (visible) => {
    const message = visible.message();
    await visible.accept();
    return message;
  });
  await page
    .getByRole("button", { name: "View Permissions", exact: true })
    .click();
  const visible = await dialog;
  expect(visible).toContain("Read quizzes and library");
  expect(visible).toContain("Create, edit and share quizzes");
  expect(visible).toContain("future:permission");
});
