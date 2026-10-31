import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PerksStats } from "./perks-stats";

afterEach(cleanup);

describe("partner stats", () => {
  it("shows rounded lower bounds immediately, with savings as an upper bound", () => {
    const { container } = render(<PerksStats />);
    const values = [...container.querySelectorAll("dd")].map((node) =>
      node.textContent.replaceAll(/\s/g, ""),
    );

    expect(values).toEqual(["500000+", "250+", "do2000zł"]);
    expect(
      [...container.querySelectorAll("dt")].map((node) => node.textContent),
    ).toEqual(["studentów", "ofert do\u00A0−50%", "oszczędności rocznie"]);
  });
});
