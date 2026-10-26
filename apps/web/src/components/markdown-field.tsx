"use client";

import {
  BoldIcon,
  CodeIcon,
  CodeXmlIcon,
  EllipsisIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PiIcon,
  QuoteIcon,
  Redo2Icon,
  SigmaIcon,
  Undo2Icon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  ClipboardEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";

import {
  activeInlineFormats,
  formatMarkdownSelection,
} from "@/lib/markdown-format";
import type { MarkdownFormat } from "@/lib/markdown-format";
import { moveRovingFocus } from "@/lib/roving-focus";
import { cn } from "@/lib/utils";

import { MarkdownRenderer } from "./markdown-renderer";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { KbdShortcut } from "./ui/kbd-shortcut";
import { Separator } from "./ui/separator";
import { Toggle } from "./ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface MarkdownToolbarTargets {
  /** The field that was focused last. */
  active: RefObject<HTMLTextAreaElement | null>;
  /**
   * Id of the field the toolbar is formatting while the toolbar or its menu
   * has focus, so that field keeps showing its source.
   */
  heldId: string | null;
  setHeldId: (id: string | null) => void;
}

const MarkdownToolbarContext = createContext<MarkdownToolbarTargets | null>(
  null,
);

/** Lets one toolbar format whichever field inside it was focused last. */
export function MarkdownToolbarProvider({ children }: { children: ReactNode }) {
  const active = useRef<HTMLTextAreaElement>(null);
  const [heldId, setHeldId] = useState<string | null>(null);
  return (
    <MarkdownToolbarContext value={{ active, heldId, setHeldId }}>
      {children}
    </MarkdownToolbarContext>
  );
}

const MARKUP_PATTERN = /[*_`$\\~|[\]]|^\s{0,3}(?:[#>]|[-+]\s|\d+[.)]\s)/m;

function hasMarkdownMarkup(value: string) {
  return MARKUP_PATTERN.test(value);
}

/**
 * Replaces the textarea value through the browser's editing commands, so the
 * native undo stack keeps working, and falls back to an input event.
 */
function replaceValue(textarea: HTMLTextAreaElement, next: string) {
  const current = textarea.value;
  let prefix = 0;
  while (
    prefix < current.length &&
    prefix < next.length &&
    current[prefix] === next[prefix]
  ) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < current.length - prefix &&
    suffix < next.length - prefix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  const inserted = next.slice(prefix, next.length - suffix);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(prefix, current.length - suffix);
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- The only API which keeps native undo history for scripted edits.
    document.execCommand(
      inserted === "" ? "delete" : "insertText",
      false,
      inserted,
    );
  } catch {
    // Handled by the fallback below.
  }
  if (textarea.value !== next) {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(textarea, next);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function formatTextarea(textarea: HTMLTextAreaElement, format: MarkdownFormat) {
  if (textarea.disabled || textarea.readOnly) {
    return;
  }
  // A textarea keeps its selection after losing focus.
  const result = formatMarkdownSelection(
    textarea.value,
    textarea.selectionStart,
    textarea.selectionEnd,
    format,
  );
  replaceValue(textarea, result.value);
  textarea.setSelectionRange(result.start, result.end);
}

const shortcuts: Partial<Record<string, MarkdownFormat>> = {
  b: "bold",
  i: "italic",
  e: "code",
  k: "link",
};

export interface MarkdownFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** Classes for the wrapper. */
  className?: string;
  /** Typography and padding shared by the textarea and its rendered view. */
  inputClassName?: string;
  minHeight?: string;
  maxHeight?: string;
  /** False makes the field a plain textarea: no preview and no formatting shortcuts. */
  markdown?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * An auto-growing Markdown textarea. While it is not focused, text with
 * Markdown or LaTeX shows as it will in the quiz; the transparent textarea
 * stays on top, so clicking or tabbing into it edits the source. The source
 * also stays while the toolbar formats this field, so opening its menu does
 * not flip the field to the rendered view.
 */
export function MarkdownField({
  id,
  label,
  value,
  onChange,
  placeholder,
  invalid = false,
  describedBy,
  disabled = false,
  className,
  inputClassName,
  minHeight,
  maxHeight,
  markdown = true,
  onBlur,
  onFocus,
  onPaste,
  onKeyDown,
}: MarkdownFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbar = use(MarkdownToolbarContext);
  // The refs stay the same across renders, unlike the context object.
  const activeTarget = toolbar?.active;
  const [focused, setFocused] = useState(false);
  // The selection when focus left for the toolbar; a textarea does not show
  // its selection without focus, so it is drawn underneath instead.
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const held = toolbar?.heldId === id;
  const rendered = markdown && !focused && !held && hasMarkdownMarkup(value);
  const shownSelection = held && !focused ? selection : null;

  useEffect(() => {
    const textarea = textareaRef.current;
    // The first field, the question text, is the target until one is focused,
    // so a toolbar reached with Tab before any field still works.
    if (activeTarget?.current === null) {
      activeTarget.current = textarea;
    }
    return () => {
      if (activeTarget?.current === textarea) {
        activeTarget.current = null;
      }
    };
  }, [activeTarget]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea === null) {
      return;
    }
    if (rendered) {
      textarea.style.height = "";
      return;
    }
    const resize = () => {
      textarea.style.height = "0px";
      textarea.style.height = `${String(textarea.scrollHeight)}px`;
    };
    resize();
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth !== width) {
        width = textarea.clientWidth;
        resize();
      }
    });
    observer.observe(textarea);
    return () => {
      observer.disconnect();
    };
  }, [value, rendered]);

  return (
    <div
      className={cn("relative min-w-0", className)}
      data-slot="markdown-field"
      // Lets a wrapper keep its focus styling while the toolbar formats this field.
      data-held={held ? "" : undefined}
    >
      {shownSelection === null ? null : (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap text-transparent",
            inputClassName,
          )}
        >
          {value.slice(0, shownSelection[0])}
          <span className="bg-primary/20 rounded-xs">
            {value.slice(shownSelection[0], shownSelection[1])}
          </span>
          {value.slice(shownSelection[1])}
          {"\n"}
        </div>
      )}
      {rendered ? (
        <div
          aria-hidden="true"
          // Never clipped, so the whole rendered text can be proofread.
          className={cn("overflow-x-auto", inputClassName)}
          style={{ minHeight }}
        >
          <MarkdownRenderer className="prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-pre:my-1 prose-blockquote:my-0 prose-headings:my-0 text-[length:inherit] leading-[inherit] [&_.katex-display]:my-1">
            {value}
          </MarkdownRenderer>
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        rows={1}
        className={cn(
          "text-foreground placeholder:text-muted-foreground/80 caret-primary selection:bg-primary/20 block w-full resize-none overflow-hidden bg-transparent outline-none disabled:cursor-not-allowed",
          inputClassName,
          rendered && "absolute inset-0 opacity-0",
        )}
        style={rendered ? undefined : { minHeight, maxHeight }}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={(event) => {
          setFocused(true);
          if (activeTarget !== undefined) {
            activeTarget.current = event.currentTarget;
          }
          onFocus?.();
        }}
        onBlur={(event) => {
          const { selectionStart, selectionEnd } = event.currentTarget;
          setSelection(
            selectionStart === selectionEnd
              ? null
              : [selectionStart, selectionEnd],
          );
          setFocused(false);
          onBlur?.();
        }}
        onPaste={onPaste}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            !markdown ||
            event.defaultPrevented ||
            event.nativeEvent.defaultPrevented ||
            event.nativeEvent.isComposing ||
            !(event.metaKey || event.ctrlKey) ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          const format = shortcuts[event.key.toLowerCase()];
          if (format !== undefined) {
            event.preventDefault();
            formatTextarea(event.currentTarget, format);
          }
        }}
      />
    </div>
  );
}

interface Shortcut {
  macKey?: string;
  winKey?: string;
  suffix: string;
}

const inlineFormats: {
  format: MarkdownFormat;
  label: string;
  shortcut?: Shortcut;
  icon: LucideIcon;
}[] = [
  {
    format: "bold",
    label: "Pogrubienie",
    shortcut: { suffix: "B" },
    icon: BoldIcon,
  },
  {
    format: "italic",
    label: "Kursywa",
    shortcut: { suffix: "I" },
    icon: ItalicIcon,
  },
  {
    format: "code",
    label: "Kod",
    shortcut: { suffix: "E" },
    icon: CodeXmlIcon,
  },
  { format: "math", label: "Wzór LaTeX", icon: SigmaIcon },
];

const blockFormats: {
  format: MarkdownFormat;
  label: string;
  icon: LucideIcon;
}[] = [
  { format: "link", label: "Link", icon: LinkIcon },
  { format: "bullet", label: "Lista punktowana", icon: ListIcon },
  { format: "numbered", label: "Lista numerowana", icon: ListOrderedIcon },
  { format: "quote", label: "Cytat", icon: QuoteIcon },
  { format: "h3", label: "Nagłówek", icon: HeadingIcon },
  { format: "codeBlock", label: "Blok kodu", icon: CodeIcon },
  { format: "mathBlock", label: "Blok wzoru", icon: PiIcon },
];

/** Keeps the caret and selection in the field being formatted. */
function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

/**
 * A tooltip above a toolbar button, with its shortcut. It lets the pointer
 * through, so the next button can be reached while it is still showing.
 */
function ToolbarTooltip({
  label,
  shortcut,
  render,
}: {
  label: string;
  shortcut?: Shortcut;
  render: ReactElement;
}) {
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger render={render} />
      <TooltipContent side="top" className="pointer-events-none">
        {label}
        {shortcut === undefined ? null : <KbdShortcut {...shortcut} />}
      </TooltipContent>
    </Tooltip>
  );
}

function toolbarItems(toolbar: HTMLElement | null) {
  return toolbar === null
    ? []
    : [...toolbar.querySelectorAll<HTMLElement>("button:not(:disabled)")];
}

/**
 * Formatting buttons for the field inside the provider that was focused last.
 * They work while that field, or the toolbar itself, has focus, and show
 * which inline formats surround the caret. Otherwise they are marked
 * `aria-disabled` but keep their tab stop, so the keyboard can reach them. `children` sit after the inline
 * buttons, before the menu.
 */
export interface ToolbarHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export function MarkdownToolbar({
  label = "Formatowanie tekstu",
  disabled = false,
  className,
  history,
  formatting = true,
  children,
}: {
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Undo and redo buttons; they work whenever there is a step to apply. */
  history?: ToolbarHistory;
  /** False leaves only undo and redo, for fields without Markdown. */
  formatting?: boolean;
  children?: ReactNode;
}) {
  const toolbar = use(MarkdownToolbarContext);
  // The refs and the setter stay the same across renders, unlike the context object.
  const activeTarget = toolbar?.active;
  const setHeldId = toolbar?.setHeldId;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // A format picked from the menu, applied once the menu has closed.
  const pendingFormat = useRef<MarkdownFormat | null>(null);
  const focusIndex = useRef(0);
  const [state, setState] = useState<{
    enabled: boolean;
    active: MarkdownFormat[];
  }>({ enabled: false, active: [] });

  // Follows focus and the caret: the buttons are enabled while the field, the
  // toolbar or its menu has focus, and pressed inside the formats around the
  // caret. The field is told it is held, so it keeps showing its source.
  useEffect(() => {
    const update = () => {
      const field = activeTarget?.current ?? null;
      const focus = document.activeElement;
      const enabled =
        field !== null &&
        field.isConnected &&
        (focus === field ||
          toolbarRef.current?.contains(focus) === true ||
          menuRef.current?.contains(focus) === true);
      setHeldId?.(enabled ? field.id : null);
      const active = enabled
        ? activeInlineFormats(
            field.value,
            field.selectionStart,
            field.selectionEnd,
          )
        : [];
      setState((current) =>
        current.enabled === enabled &&
        current.active.length === active.length &&
        current.active.every((format, index) => format === active[index])
          ? current
          : { enabled, active },
      );
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    document.addEventListener("selectionchange", update);
    document.addEventListener("input", update, true);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("input", update, true);
      setHeldId?.(null);
    };
  }, [activeTarget, setHeldId]);

  // One tab stop for the toolbar. The buttons include `children`, so their
  // tab order is set on the DOM rather than through props.
  useLayoutEffect(() => {
    const items = toolbarItems(toolbarRef.current);
    const current = Math.min(focusIndex.current, items.length - 1);
    for (const [index, item] of items.entries()) {
      item.tabIndex = index === current ? 0 : -1;
    }
  });

  const inactive = disabled || !state.enabled;

  function apply(format: MarkdownFormat) {
    const active = activeTarget?.current;
    if (active?.isConnected === true) {
      formatTextarea(active, format);
    }
  }

  // Inactive buttons stay in the tab order, so Shift+Tab from a field reaches
  // the toolbar; they only look and act disabled.
  const buttonClassName =
    "text-muted-foreground hover:text-foreground pointer-coarse:size-10 aria-disabled:pointer-events-none aria-disabled:opacity-50";

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn("flex min-w-0 items-center gap-0.5", className)}
      // Also for clicks landing on the toolbar itself, such as on a button
      // which just became disabled under a fast series of undo clicks.
      onMouseDown={keepFocus}
      onFocus={(event) => {
        const items = toolbarItems(event.currentTarget);
        const index = items.indexOf(event.target);
        if (index !== -1) {
          focusIndex.current = index;
          for (const [other, item] of items.entries()) {
            item.tabIndex = other === index ? 0 : -1;
          }
        }
      }}
      onKeyDown={(event) => {
        moveRovingFocus(event, "button:not(:disabled)", "horizontal");
      }}
    >
      {history === undefined ? null : (
        <>
          {(
            [
              [
                "undo",
                "Cofnij",
                "Control+Z",
                { suffix: "Z" },
                Undo2Icon,
                history.canUndo,
              ],
              [
                "redo",
                "Ponów",
                "Control+Shift+Z",
                { macKey: "⇧ ⌘", winKey: "Ctrl + Shift +", suffix: "Z" },
                Redo2Icon,
                history.canRedo,
              ],
            ] as const
          ).map(([command, title, keys, shortcut, Icon, can]) => (
            <ToolbarTooltip
              key={command}
              label={title}
              shortcut={shortcut}
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={buttonClassName}
                  aria-label={title}
                  aria-keyshortcuts={keys}
                  disabled={disabled}
                  aria-disabled={!can}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    if (can) {
                      history[command]();
                    }
                  }}
                >
                  <Icon />
                </Button>
              }
            />
          ))}
          {formatting ? (
            <Separator orientation="vertical" className="mx-0.5 h-4" />
          ) : null}
        </>
      )}
      {formatting ? (
        <>
          {inlineFormats.map(
            ({ format, label: title, shortcut, icon: Icon }) => (
              <ToolbarTooltip
                key={format}
                label={title}
                shortcut={shortcut}
                render={
                  <Toggle
                    size="sm"
                    className={cn(
                      buttonClassName,
                      // Tinted with the primary colour, which stands out on the muted toolbar in both themes.
                      "aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:bg-primary/25 size-8 px-0",
                    )}
                    aria-label={title}
                    aria-keyshortcuts={
                      shortcut === undefined
                        ? undefined
                        : `Control+${shortcut.suffix}`
                    }
                    disabled={disabled}
                    aria-disabled={inactive}
                    pressed={state.active.includes(format)}
                    onMouseDown={keepFocus}
                    onPressedChange={() => {
                      if (!inactive) {
                        apply(format);
                      }
                    }}
                  >
                    <Icon />
                  </Toggle>
                }
              />
            ),
          )}
          {children}
          <DropdownMenu
            modal={false}
            // Formatting focuses the field. Done while the menu is still
            // open, that counts as focus leaving the menu, which makes Base UI
            // skip returning focus, so the field would end up unfocused.
            onOpenChangeComplete={(open) => {
              const format = pendingFormat.current;
              if (!open && format !== null) {
                pendingFormat.current = null;
                apply(format);
              }
            }}
          >
            <ToolbarTooltip
              label="Więcej formatowania"
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={buttonClassName}
                      aria-label="Więcej formatowania"
                      disabled={disabled || inactive}
                      onMouseDown={keepFocus}
                    >
                      <EllipsisIcon />
                    </Button>
                  }
                />
              }
            />
            <DropdownMenuContent
              ref={menuRef}
              className="w-52"
              // Closing goes back to the field. Base UI ignores this for a
              // click outside, which keeps the focus where it landed.
              finalFocus={() => activeTarget?.current ?? false}
            >
              {blockFormats.map(({ format, label: title, icon: Icon }) => (
                <DropdownMenuItem
                  key={format}
                  onClick={() => {
                    pendingFormat.current = format;
                  }}
                >
                  <Icon />
                  {title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}
