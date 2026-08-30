import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  ResponsiveTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const items = [
  { label: "Pierwsza", value: "first" },
  { label: "Druga", value: "second" },
  { label: "Trzecia", value: "third" },
];

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function renderTabs() {
  return render(
    <ResponsiveTabs defaultValue="first">
      <TabsList>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value}>
          {item.label} panel
        </TabsContent>
      ))}
    </ResponsiveTabs>,
  );
}

afterEach(() => {
  setViewportWidth(1024);
});

describe("ResponsiveTabs", () => {
  it("uses Base UI vertical keyboard navigation on desktop", async () => {
    setViewportWidth(1024);
    const user = userEvent.setup();
    renderTabs();
    const tabs = screen.getAllByRole("tab");

    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    await user.click(tabs[0]);
    await user.keyboard("{ArrowDown}");
    expect(tabs[1]).toHaveFocus();
  });

  it("uses Base UI horizontal keyboard navigation on mobile", async () => {
    setViewportWidth(375);
    const user = userEvent.setup();
    renderTabs();
    const tabs = screen.getAllByRole("tab");

    expect(screen.getByRole("tablist")).not.toHaveAttribute("aria-orientation");
    await user.click(tabs[0]);
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
  });

  it("renders one Base UI tabs tree", () => {
    renderTabs();

    expect(
      screen.getByRole("tablist").closest('[data-slot="tabs"]'),
    ).toHaveAttribute("data-responsive-tabs");
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    expect(screen.getAllByRole("tab", { hidden: true })).toHaveLength(3);
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(1);
  });
});
