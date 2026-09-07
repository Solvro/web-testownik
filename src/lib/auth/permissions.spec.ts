import { describe, expect, it } from "vitest";

import { ACCOUNT_LEVELS, ACCOUNT_TYPES } from "@/types/user";

import { PermissionAction, hasPermission } from "./permissions";

describe("profile photo upload permission", () => {
  for (const accountType of ACCOUNT_TYPES) {
    it.each(ACCOUNT_LEVELS)(
      `${accountType} / %s follows the Gold-only permission`,
      (accountLevel) => {
        expect(
          hasPermission(
            accountType,
            PermissionAction.UPLOAD_PROFILE_PHOTO,
            accountLevel,
          ),
        ).toBe(accountType !== "guest" && accountLevel === "gold");
      },
    );
  }

  it("does not grant uploads to missing accounts or unknown levels", () => {
    expect(
      hasPermission(undefined, PermissionAction.UPLOAD_PROFILE_PHOTO, "gold"),
    ).toBe(false);
    expect(hasPermission("email", PermissionAction.UPLOAD_PROFILE_PHOTO)).toBe(
      false,
    );
  });

  it("preserves permissions that do not depend on account level", () => {
    expect(hasPermission("email", PermissionAction.NOTIFICATION_SETTINGS)).toBe(
      true,
    );
    expect(
      hasPermission("guest", PermissionAction.NOTIFICATION_SETTINGS, "gold"),
    ).toBe(false);
  });
});
