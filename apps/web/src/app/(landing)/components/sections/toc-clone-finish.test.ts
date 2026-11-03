import { expect, it } from "vitest";

import { finishPerkCounters, finishTimelineReveal } from "./toc-clone-finish";

function html(markup: string): HTMLElement {
  const root = document.createElement("section");
  root.innerHTML = markup;
  return root;
}

it("shows the final perks counts", () => {
  const clone = html(
    '<span data-perk-count="500 000">0</span><span data-perk-count="12">3</span>',
  );
  finishPerkCounters(clone);
  expect([...clone.querySelectorAll("span")].map((s) => s.textContent)).toEqual(
    ["500 000", "12"],
  );
});

it("shows unrevealed story events finished", () => {
  const clone = html(`
    <svg data-timeline-ink style="stroke-dashoffset: 1"></svg>
    <ol>
      <li data-timeline-revealed="false">
        <h3><span data-timeline-title="Pierwsza wersja"></span></h3>
      </li>
      <li data-timeline-revealed="true">
        <h3><span data-timeline-title="Druga">Dr</span></h3>
      </li>
    </ol>
  `);
  finishTimelineReveal(clone);

  expect(
    [...clone.querySelectorAll("li")].map((li) => li.dataset.timelineRevealed),
  ).toEqual(["true", "true"]);
  expect(
    [...clone.querySelectorAll("[data-timeline-title]")].map(
      (title) => title.textContent,
    ),
  ).toEqual(["Pierwsza wersja", "Druga"]);
  expect(
    clone.querySelector<SVGElement>("[data-timeline-ink]")?.style
      .strokeDashoffset,
  ).toBe("0");
});
