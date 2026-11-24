import { ACCOUNT_LEVELS, ACCOUNT_TYPES } from "@testownik/core/user/types";
import { describe, expect, it } from "vitest";

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

describe("connecting apps over OAuth", () => {
  it.each(ACCOUNT_TYPES)(
    "%s accounts follow the no-guests rule",
    (accountType) => {
      expect(hasPermission(accountType, PermissionAction.CONNECT_APPS)).toBe(
        accountType !== "guest",
      );
    },
  );

  it("is not granted without an account", () => {
    expect(hasPermission(undefined, PermissionAction.CONNECT_APPS)).toBe(false);
  });
});
