export function isInputElement(target: HTMLElement): boolean {
  const tagName = target.tagName.toLowerCase();
  return (
    (tagName === "input" || tagName === "textarea") &&
    (target as HTMLInputElement).type !== "checkbox"
  );
}

export function isModalOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"]'));
}
