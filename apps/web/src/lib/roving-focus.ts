import type { KeyboardEvent } from "react";

const keys = {
  vertical: { previous: "ArrowUp", next: "ArrowDown" },
  horizontal: { previous: "ArrowLeft", next: "ArrowRight" },
};

/**
 * Moves focus between the enabled `selector` items inside the event's current
 * target with the arrow keys, Home, and End. Returns the newly focused item.
 */
export function moveRovingFocus(
  event: KeyboardEvent<HTMLElement>,
  selector: string,
  orientation: keyof typeof keys,
) {
  const { previous, next } = keys[orientation];
  if (
    ![previous, next, "Home", "End"].includes(event.key) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return null;
  }
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(selector),
  ].filter(
    (item) => !item.matches(":disabled") && item.closest("[hidden]") === null,
  );
  const current = items.findIndex((item) =>
    item.contains(event.target as Node),
  );
  if (current === -1 || items.length === 0) {
    return null;
  }
  const target =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === next
          ? Math.min(current + 1, items.length - 1)
          : Math.max(current - 1, 0);
  event.preventDefault();
  const item = items[target];
  item.focus();
  item.scrollIntoView({ block: "nearest" });
  return item;
}
