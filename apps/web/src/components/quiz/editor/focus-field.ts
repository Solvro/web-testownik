/**
 * Focuses a field once it has rendered, for example after adding an answer or
 * switching to another question, and puts the caret at the end.
 */
export function focusField(id: string) {
  // Sonner returns focus to where it was when focus leaves a toast, which
  // would undo this. Leaving the toast first lets it do that right away.
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.closest("[data-sonner-toaster]") !== null
  ) {
    active.blur();
  }
  let attempts = 0;
  const focus = () => {
    const field = document.querySelector(`[id="${id}"]`);
    if (
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLInputElement
    ) {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ block: "nearest" });
      field.setSelectionRange(field.value.length, field.value.length);
    } else if (attempts++ < 10) {
      requestAnimationFrame(focus);
    }
  };
  requestAnimationFrame(focus);
}
