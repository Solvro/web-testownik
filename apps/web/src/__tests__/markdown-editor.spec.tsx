import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { ClipboardEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { MarkdownEditor } from "@/components/markdown-editor";
import {
  MarkdownField,
  MarkdownToolbar,
  MarkdownToolbarProvider,
} from "@/components/markdown-field";

afterEach(cleanup);

function Editor({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <MarkdownEditor value={value} onChange={setValue} label="Odpowiedź 1" />
  );
}

function SharedToolbar() {
  const [first, setFirst] = useState("pierwsze");
  const [second, setSecond] = useState("drugie");
  return (
    <MarkdownToolbarProvider>
      <MarkdownToolbar />
      <MarkdownField
        id="first"
        label="Pierwsze"
        value={first}
        onChange={setFirst}
      />
      <MarkdownField
        id="second"
        label="Drugie"
        value={second}
        onChange={setSecond}
      />
    </MarkdownToolbarProvider>
  );
}

it("formats a selection, keeps it selected, and toggles the formatting off", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue="Zażółć gęślą jaźń" />);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "Odpowiedź 1",
  });
  textarea.focus();
  textarea.setSelectionRange(7, 12);
  await user.click(screen.getByRole("button", { name: "Pogrubienie" }));
  expect(textarea).toHaveValue("Zażółć **gęślą** jaźń");
  expect(textarea).toHaveFocus();
  expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([9, 14]);
  await user.click(screen.getByRole("button", { name: "Pogrubienie" }));
  expect(textarea).toHaveValue("Zażółć gęślą jaźń");
});

it("applies block formats from the menu", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue={"jeden\ndwa"} />);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  textarea.focus();
  textarea.setSelectionRange(0, 9);
  await user.click(screen.getByRole("button", { name: "Więcej formatowania" }));
  await user.click(
    await screen.findByRole("menuitem", { name: "Lista numerowana" }),
  );
  expect(textarea).toHaveValue("1. jeden\n2. dwa");
});

it("keeps showing the source while the formatting menu is open", async () => {
  const user = userEvent.setup();
  const { container } = render(<Editor initialValue="**Róża**" />);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "Odpowiedź 1",
  });
  await user.click(textarea);
  textarea.setSelectionRange(0, 8);
  await user.click(screen.getByRole("button", { name: "Więcej formatowania" }));
  // The browser moves focus into the open menu; jsdom needs a hand.
  (await screen.findByRole("menuitem", { name: "Cytat" })).focus();
  expect(textarea).not.toHaveFocus();
  expect(container.querySelector("strong")).toBeNull();
  expect(textarea).toHaveValue("**Róża**");

  await user.keyboard("{Escape}");
  await waitFor(() => {
    expect(textarea).toHaveFocus();
  });
  expect(container.querySelector("strong")).toBeNull();

  await user.click(document.body);
  expect(container.querySelector("strong")).toHaveTextContent("Róża");
});

it("supports formatting shortcuts and selects the link address", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue="tekst" />);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  await user.click(textarea);
  textarea.setSelectionRange(0, 5);
  await user.keyboard("{Control>}i{/Control}");
  expect(textarea).toHaveValue("_tekst_");
  textarea.setSelectionRange(1, 6);
  await user.keyboard("{Control>}i{/Control}");
  expect(textarea).toHaveValue("tekst");
  textarea.setSelectionRange(0, 5);
  await user.keyboard("{Control>}k{/Control}");
  expect(textarea).toHaveValue("[tekst](url)");
  expect(
    textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
  ).toBe("url");
});

it("shows rendered Markdown and LaTeX until the field is focused", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <>
      <Editor initialValue="**Róża** i $x^2$" />
      <button type="button">Dalej</button>
    </>,
  );
  const textarea = screen.getByRole("textbox", { name: "Odpowiedź 1" });
  expect(container.querySelector("strong")).toHaveTextContent("Róża");
  expect(container.querySelector(".katex")).not.toBeNull();

  await user.click(textarea);
  expect(container.querySelector("strong")).toBeNull();
  expect(textarea).toHaveValue("**Róża** i $x^2$");

  await user.click(screen.getByRole("button", { name: "Dalej" }));
  expect(container.querySelector("strong")).toHaveTextContent("Róża");
  expect(textarea).toHaveValue("**Róża** i $x^2$");
});

it("keeps plain text as an ordinary textarea", () => {
  const { container } = render(<Editor initialValue="Zwykły tekst" />);
  expect(container.querySelector(".prose")).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue("Zwykły tekst");
});

it("formats the field focused last and is disabled until a field has focus", async () => {
  const user = userEvent.setup();
  render(<SharedToolbar />);
  const first = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "Pierwsze",
  });
  const second = screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "Drugie",
  });
  const code = screen.getByRole("button", { name: "Kod" });
  expect(code).toHaveAttribute("aria-disabled", "true");

  await user.click(first);
  first.setSelectionRange(0, 8);
  expect(code).toHaveAttribute("aria-disabled", "false");
  await user.click(code);
  expect(first).toHaveValue("`pierwsze`");

  await user.click(second);
  second.setSelectionRange(0, 6);
  await user.click(screen.getByRole("button", { name: "Kursywa" }));
  expect(second).toHaveValue("_drugie_");
  expect(first).toHaveValue("`pierwsze`");
});

it("shows the formats around the caret as pressed and removes them", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue="Dziedziną **informatyki** tworzącą" />);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
  const bold = screen.getByRole("button", { name: "Pogrubienie" });
  await user.click(textarea);
  textarea.setSelectionRange(16, 16);
  fireEvent(document, new Event("selectionchange"));
  expect(bold).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Kursywa" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await user.click(bold);
  expect(textarea).toHaveValue("Dziedziną informatyki tworzącą");
  fireEvent(document, new Event("selectionchange"));
  expect(bold).toHaveAttribute("aria-pressed", "false");
});

it("synchronizes parent-driven updates without emitting an edit", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <MarkdownEditor value="Stara treść" onChange={onChange} />,
  );
  rerender(<MarkdownEditor value="Nowa treść" onChange={onChange} />);
  expect(screen.getByRole("textbox")).toHaveValue("Nowa treść");
  expect(onChange).not.toHaveBeenCalled();
});

it("forwards paste and key events and lets them cancel shortcuts", () => {
  const onChange = vi.fn();
  const onPaste = vi.fn((event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
  });
  const onKeyDown = vi.fn((event: KeyboardEvent) => {
    event.preventDefault();
  });
  render(
    <MarkdownEditor
      value="abc"
      onChange={onChange}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
    />,
  );
  const textarea = screen.getByRole("textbox");
  fireEvent.paste(textarea, { clipboardData: { getData: () => "x" } });
  expect(onPaste).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });
  expect(onKeyDown).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalled();
});

it("exposes invalid and disabled field states", () => {
  const { rerender } = render(
    <MarkdownEditor
      value=""
      onChange={vi.fn()}
      label="Treść"
      invalid
      describedBy="treść-błąd"
    />,
  );
  const textarea = screen.getByRole("textbox", { name: "Treść" });
  expect(textarea).toHaveAttribute("aria-invalid", "true");
  expect(textarea).toHaveAttribute("aria-describedby", "treść-błąd");
  rerender(
    <MarkdownEditor value="" onChange={vi.fn()} label="Treść" disabled />,
  );
  expect(screen.getByRole("textbox", { name: "Treść" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Pogrubienie" })).toBeDisabled();
});
