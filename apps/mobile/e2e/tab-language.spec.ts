import { expect, test } from "@playwright/test";

test("language switches all tab labels and keeps the profile selected", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "locale-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "locale-fixture", is_guest: false }
        : [],
    }),
  );
  await page.goto("/profile");
  for (const label of ["Study", "Library", "Grades", "Profile"])
    await expect(
      page.getByRole("tab", { name: label, exact: true }),
    ).toBeVisible();
  await page.getByRole("button", { name: "Polski", exact: true }).click();
  for (const label of ["Nauka", "Biblioteka", "Oceny", "Profil"])
    await expect(
      page.getByRole("tab", { name: label, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Profil", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Profile", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
