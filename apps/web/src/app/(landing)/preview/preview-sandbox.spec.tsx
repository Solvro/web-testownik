import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { PreviewSandbox } from "./preview-provider";

function getPortalLayer(container: HTMLElement): HTMLElement {
  const layer = container.querySelector<HTMLElement>("[data-preview-portal]");
  if (layer === null) {
    throw new Error("PreviewSandbox did not render its portal layer");
  }
  return layer;
}

describe("PreviewSandbox", () => {
  it("mounts tooltips and popovers into the screen, not document.body", async () => {
    const { container } = render(
      <PreviewSandbox>
        <Tooltip open>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Tooltip inside the screen</TooltipContent>
        </Tooltip>
        <Popover open>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Popover inside the screen</PopoverContent>
        </Popover>
      </PreviewSandbox>,
    );

    const layer = getPortalLayer(container);
    const tooltip = await screen.findByText("Tooltip inside the screen");
    const popover = await screen.findByText("Popover inside the screen");

    expect(layer).toContainElement(tooltip);
    expect(layer).toContainElement(popover);
    // The layer is the sandbox's own child, so the overlays share the
    // screen's box, clipping and transforms instead of the page's.
    expect(layer.parentElement).toHaveAttribute("data-preview-sandbox");
  });

  it("leaves portals outside a sandbox on document.body", async () => {
    const { container } = render(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Page tooltip</TooltipContent>
      </Tooltip>,
    );

    const tooltip = await screen.findByText("Page tooltip");
    expect(container).not.toContainElement(tooltip);
    expect(document.body).toContainElement(tooltip);
  });

  it("cancels navigation from links inside the screen", () => {
    render(
      <PreviewSandbox>
        <Link href="/quiz/preview/stats">Statystyki</Link>
      </PreviewSandbox>,
    );

    const notCancelled = fireEvent.click(screen.getByText("Statystyki"));
    expect(notCancelled).toBe(false);
  });

  it("hands the cancelled link's href to the screen", () => {
    const onNavigate = vi.fn();
    render(
      <PreviewSandbox onNavigate={onNavigate}>
        <Link href="/quiz/preview/stats">Statystyki</Link>
      </PreviewSandbox>,
    );

    fireEvent.click(screen.getByText("Statystyki"));
    expect(onNavigate).toHaveBeenCalledWith("/quiz/preview/stats");
  });
});
