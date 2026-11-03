import { describe, expect, it } from "vitest";

import {
  BARE_DOCUMENT_SHELL,
  DOCUMENT_PATHNAME_HEADER,
  DOCUMENT_SHELL_HEADER,
  shouldRenderBareDocument,
} from "./document-shell";

describe("document shell decision", () => {
  it.each([
    "/quiz/review-probe.json",
    "/quiz/review-probe.svg",
    "/quiz/review-probe.webmanifest",
    "/landing-screen-probe/quiz",
    "/landing-screen",
  ])("keeps the app shell on %s despite a bare header", (pathname) => {
    expect(
      shouldRenderBareDocument(
        new Headers({
          [DOCUMENT_SHELL_HEADER]: BARE_DOCUMENT_SHELL,
          [DOCUMENT_PATHNAME_HEADER]: pathname,
        }),
      ),
    ).toBe(false);
  });

  it("ignores a bare header without the proxy pathname", () => {
    expect(
      shouldRenderBareDocument(
        new Headers({ [DOCUMENT_SHELL_HEADER]: BARE_DOCUMENT_SHELL }),
      ),
    ).toBe(false);
  });

  it("requires the bare marker even for a screen pathname", () => {
    expect(
      shouldRenderBareDocument(
        new Headers({ [DOCUMENT_PATHNAME_HEADER]: "/landing-screen/quiz" }),
      ),
    ).toBe(false);
  });

  it("uses the bare shell for a marked landing screen", () => {
    expect(
      shouldRenderBareDocument(
        new Headers({
          [DOCUMENT_SHELL_HEADER]: BARE_DOCUMENT_SHELL,
          [DOCUMENT_PATHNAME_HEADER]: "/landing-screen/quiz",
        }),
      ),
    ).toBe(true);
  });
});
