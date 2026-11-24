import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePageClient } from "@/app/profile/client";
import { server } from "@/test-utils/mocks/server";
import { Providers } from "@/test-utils/providers";
import { generateTestToken } from "@/test-utils/token-factory";

// Only the tab list matters here; the panels pull in heavy editors and emoji sets.
vi.mock("@/components/profile/ai-settings-form", () => ({
  AiSettingsForm: () => null,
}));
vi.mock("@/components/profile/ai-usage-card", () => ({
  AIUsageCard: () => null,
}));
vi.mock("@/components/profile/authorized-apps-list", () => ({
  AuthorizedAppsList: () => null,
}));
vi.mock("@/components/profile/notifications-form", () => ({
  NotificationsForm: () => null,
}));
vi.mock("@/components/profile/profile-details", () => ({
  ProfileDetails: () => null,
}));
vi.mock("@/components/profile/settings-form", () => ({
  SettingsForm: () => null,
}));

const renderProfile = async (accountType: "guest" | "student") => {
  const token = await generateTestToken({ account_type: accountType });
  render(
    <Providers accessToken={token}>
      <ProfilePageClient />
    </Providers>,
  );
};

beforeEach(() => {
  server.use(
    http.get("*/user/", () => HttpResponse.json({})),
    http.get("*/settings/", () => HttpResponse.json({})),
  );
});

describe("ProfilePage integrations tab", () => {
  it("is hidden from guests, who cannot connect apps", async () => {
    await renderProfile("guest");

    expect(await screen.findByRole("tab", { name: "Konto" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Integracje" })).toBeNull();
  });

  it("is shown to accounts that can connect apps", async () => {
    await renderProfile("student");

    expect(
      await screen.findByRole("tab", { name: "Integracje" }),
    ).toBeVisible();
  });
});
