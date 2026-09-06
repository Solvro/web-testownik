import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import type { ClipboardEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { OverTypeEditor } from "@/components/overtype-editor";

afterEach(cleanup);

function Editor({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <OverTypeEditor
      value={value}
      onChange={setValue}
      placeholder="Odpowiedź 1"
    />
  );
}

it("reveals editing on click and returns to rendered content after blur", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Editor />
      <button type="button">Next field</button>
    </>,
  );
  const textarea = screen.getByRole("textbox", { name: "Odpowiedź 1" });
  expect(
    screen.queryByRole("button", { name: "Pogrubienie" }),
  ).not.toBeInTheDocument();
  await user.type(textarea, "Róża");
  expect(screen.getByRole("button", { name: "Pogrubienie" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next field" }));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByText("Róża", { selector: ".prose p" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Edytuj: Odpowiedź 1" }));
  await waitFor(() => expect(textarea).toHaveFocus());
  await user.type(textarea, " i tulipan");
  expect(textarea).toHaveValue("Róża i tulipan");
  expect(
    screen.queryByRole("button", { name: /edytuj/i }),
  ).not.toBeInTheDocument();
});

it("keeps the preview and textarea synchronized after parent-driven updates", async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <OverTypeEditor value="Old content" onChange={onChange} />,
  );
  expect(
    await screen.findByText("Old content", { selector: ".prose p" }),
  ).toBeVisible();
  rerender(<OverTypeEditor value="New content" onChange={onChange} />);
  expect(screen.getByRole("textbox", { hidden: true })).toHaveValue(
    "New content",
  );
  expect(
    screen.getByText("New content", { selector: ".prose p" }),
  ).toBeVisible();
  expect(onChange).not.toHaveBeenCalled();
});

it("applies formatting to selected text and returns focus to the editor", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue="Róża" />);
  await user.click(screen.getByRole("button", { name: "Edytuj: Odpowiedź 1" }));
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  await waitFor(() => expect(textarea).toHaveFocus());
  textarea.setSelectionRange(0, 4);
  await user.click(screen.getByRole("button", { name: "Pogrubienie" }));
  expect(textarea).toHaveValue("**Róża**");
  await waitFor(() => expect(textarea).toHaveFocus());
});

it("keeps existing editors intact when another editor unmounts in Strict Mode", () => {
  const onChange = vi.fn();
  const { container, rerender } = render(
    <StrictMode>
      <OverTypeEditor value="First" onChange={onChange} />
      <OverTypeEditor value="**Text** $x$" onChange={onChange} />
    </StrictMode>,
  );
  rerender(
    <StrictMode>
      <OverTypeEditor value="**Text** $y$" onChange={onChange} />
    </StrictMode>,
  );
  expect(screen.getAllByRole("textbox", { hidden: true })).toHaveLength(1);
  expect(screen.getByRole("textbox", { hidden: true })).toHaveValue(
    "**Text** $y$",
  );
  expect(container.querySelector(".ot-math")?.textContent).toBe("$y$");
  expect(onChange).not.toHaveBeenCalled();
});

it("forwards real clipboard and keyboard events to the quiz form", () => {
  const onPaste = vi.fn((event: ClipboardEvent) => {
    event.preventDefault();
  });
  const onKeyDown = vi.fn((event: KeyboardEvent) => {
    event.preventDefault();
  });
  render(
    <OverTypeEditor
      value=""
      onChange={vi.fn()}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
    />,
  );
  const textarea = screen.getByRole("textbox");
  fireEvent.paste(textarea, { clipboardData: { files: [] } });
  fireEvent.keyDown(textarea, { key: "v", ctrlKey: true, shiftKey: true });
  expect(onPaste).toHaveBeenCalledTimes(1);
  expect(onKeyDown).toHaveBeenCalledTimes(1);
});

it("supports keyboard entry and keeps editing open while using a portaled link form", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Editor initialValue="Róża" />
      <button type="button">Next field</button>
    </>,
  );
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Edytuj: Odpowiedź 1" }),
  ).toHaveFocus();
  await user.keyboard("{Enter}");
  const textarea = screen.getByRole("textbox", { name: "Odpowiedź 1" });
  await waitFor(() => expect(textarea).toHaveFocus());
  await user.click(screen.getByRole("button", { name: "Link: Odpowiedź 1" }));
  await user.type(
    screen.getByRole("textbox", { name: "Link" }),
    "https://example.com",
  );
  expect(textarea).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Wstaw link" }));
  await waitFor(() => expect(textarea).toHaveFocus());
  expect(textarea).toHaveValue("Róża[](https://example.com)");
  await user.click(screen.getByRole("button", { name: "Podgląd" }));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
