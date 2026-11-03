import { afterEach, expect, it } from "vitest";

import {
  attachTocPreviewHost,
  invalidateTocSectionPreviews,
  showTocSectionPreview,
} from "./toc-section-preview";

afterEach(() => {
  showTocSectionPreview(null);
  invalidateTocSectionPreviews();
  document.body.replaceChildren();
});

it.each(["0", "437 500", "500 000"])(
  "shows final perks counts when the live count is %s",
  (liveValue) => {
    const section = document.createElement("section");
    section.id = "perks";
    const counter = document.createElement("span");
    counter.dataset.perkCount = "500 000";
    counter.textContent = liveValue;
    section.append(counter);
    const host = document.createElement("div");
    document.body.append(section, host);
    const detach = attachTocPreviewHost(host);
    try {
      showTocSectionPreview({ id: "perks", peek: "center" });
      const root = host.shadowRoot ?? host;
      expect(root.querySelector("[data-perk-count]")?.textContent).toBe(
        "500 000",
      );
      expect(counter.textContent).toBe(liveValue);
    } finally {
      detach();
    }
  },
);
