import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { splitHeadingAnchor } from "./heading-anchor";

describe("splitHeadingAnchor", () => {
  it("takes the anchor off a plain heading", () => {
    expect(splitHeadingAnchor("VIII. Funkcje AI {#funkcje-ai}")).toEqual({
      id: "funkcje-ai",
      children: "VIII. Funkcje AI",
    });
  });

  it("takes the anchor off the last text part", () => {
    const strong = createElement("strong", { key: "s" }, "II.");
    expect(splitHeadingAnchor([strong, " Konto {#konto}"])).toEqual({
      id: "konto",
      children: [strong, " Konto"],
    });
  });

  it("leaves headings without an anchor alone", () => {
    expect(splitHeadingAnchor("§1. Postanowienia")).toEqual({
      id: undefined,
      children: "§1. Postanowienia",
    });
  });
});
