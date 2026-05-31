import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  Bold,
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  SigmaIcon,
} from "lucide-react";
import type {
  Emphasis,
  Heading,
  InlineCode,
  Node,
  Paragraph,
  Parent,
  Root,
  RootContent,
  Strong,
  Text,
} from "mdast";
import type { InlineMath, Math } from "mdast-util-math";
import React, { useRef, useState } from "react";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

// function parse(value: string): Root {
//   return unified().use(remarkParse).use(remarkMath).parse(value);
// }

// function stringify(ast: Root): string {
//   return unified()
//     .use(remarkParse)
//     .use(remarkMath)
//     .use(remarkStringify)
//     .stringify(ast);
// }

type EditorMode = "WYSIWYG" | "Markdown";

interface Position {
  line: number;
  column: number;
  offset: number;
}

interface EditorSelection {
  anchor: Position;
  focus: Position;
}

interface EditorState {
  ast: Root;
  markdown: string;
  mode: EditorMode;
  selection: EditorSelection | null;
}

interface ToolbarAction {
  apply: (ast: Root, selection: EditorSelection) => Root;
}

const emptyDocument = unified().use(remarkParse).parse("");

const callbackTime = 150;

//region Actions

const boldAction: ToolbarAction = {
  apply(ast, selection) {},
};

//endregion

function isStylingMark(node: Node): boolean {
  return (
    node.type === "heading" ||
    node.type === "strong" ||
    node.type === "emphasis" ||
    node.type === "blockquote" ||
    node.type === "inlineCode" ||
    node.type === "code" ||
    node.type === "inlineMath" ||
    node.type === "math" ||
    node.type === "list"
  );
}

function getActiveMarks(nodes: Node[]): string[] {
  const marks: string[] = [];
  for (const node of nodes) {
    if (isStylingMark(node) && !marks.includes(node.type)) {
      marks.push(node.type);
    }
  }
  return marks;
}

function nodeOverlapsSelection(
  selection: EditorSelection | null,
  node: Node,
): boolean {
  if (selection === null) {
    return false;
  }
  const { anchor, focus } = selection;
  const nodeStart = node.position?.start.offset ?? 0;
  const nodeEnd = node.position?.end.offset ?? 0;
  return nodeStart < focus.offset && nodeEnd > anchor.offset;
}

function nodesInSelection(
  selection: EditorSelection | null,
  ast: Node,
): RootContent[] {
  if (selection === null) {
    return [];
  }

  const affected: RootContent[] = [];

  function walk(node: Node) {
    if (nodeOverlapsSelection(selection, node)) {
      affected.push(node as RootContent);
    }
    if ("children" in node) {
      for (const child of (node as Parent).children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return affected;
}

function MarkdownTextarea({
  onChange,
  onPaste,
  ...props
}: React.ComponentProps<"textarea">) {
  const [ast, setAST] = useState<Root>(emptyDocument);
  const [markdown, setMarkdown] = useState<string>("");
  const [mode, setMode] = useState<EditorMode>("WYSIWYG");
  const [selection, setSelection] = useState<EditorSelection | null>(null);

  function parseToAST(value: string): Root {
    return unified().use(remarkParse).use(remarkMath).parse(value);
  }

  const parse = useDebouncedCallback(
    (value: string) => {
      const tree = unified().use(remarkParse).use(remarkMath).parse(value);
      setAST(tree);
    },
    { wait: callbackTime },
  );

  const stringify = (ast_: Root): string => {
    return unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkStringify)
      .stringify(ast_);
  };

  function applyAction(action: ToolbarAction) {
    if (selection === null) {
      return;
    }
    const newAST = action.apply(ast, selection);
    setAST(newAST);
    setMarkdown(stringify(newAST));
  }

  function handleMarkdownChange(value: string) {
    setMarkdown(value);
    parse(value);
  }

  function switchMode() {
    if (mode === "WYSIWYG") {
      setMarkdown(stringify(ast));
      setMode("Markdown");
    } else {
      parse(markdown);
      setMode("WYSIWYG");
    }
  }

  function handleSelection(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const value = textarea.value;
    const length = value.length;

    const startIndex = textarea.selectionStart;
    const endIndex = textarea.selectionEnd;

    const newLineIndicies = [...value.matchAll(/\n/g)].map(
      (match) => match.index,
    );

    let startLine = 1;
    let endLine = 1;

    for (const index of newLineIndicies) {
      startLine = startIndex > index ? startLine + 1 : startLine;
      endLine = endIndex > index ? endLine + 1 : endLine;
    }

    newLineIndicies.push(length);

    const startColumn =
      startIndex -
      Math.max(
        ...newLineIndicies.filter((value_, _index) => value_ < startIndex),
        -1,
      );
    const endColumn =
      endIndex -
      Math.max(
        ...newLineIndicies.filter((value_, _index) => value_ < endIndex),
        -1,
      );

    const start: Position = {
      line: startLine,
      column: startColumn,
      offset: startIndex,
    };
    const end: Position = {
      line: endLine,
      column: endColumn,
      offset: endIndex,
    };

    setSelection({ anchor: start, focus: end });
  }

  function isMarkActive(
    mark: string,
    selection_: EditorSelection | null,
  ): boolean {
    return getActiveMarks(nodesInSelection(selection_, ast)).includes(mark);
  }

  return (
    <div className="flex flex-col gap-2">
      <Toolbar
        mode={mode}
        selection={selection}
        onAction={applyAction}
        onSwitchMode={switchMode}
        isActive={isMarkActive}
      />
      <MarkdownSurface
        value={markdown}
        onChange={onChange}
        onPaste={onPaste}
        onMarkdownChange={handleMarkdownChange}
        onSelection={handleSelection}
      />
      <Button
        type="button"
        onClick={(e) => {
          console.log(ast);
        }}
      >
        Log AST
      </Button>
      <Button
        type="button"
        onClick={(e) => {
          console.log(selection);
          const nodes = nodesInSelection(selection, ast);
          console.log(nodes);
        }}
      >
        Get Selected Nodes
      </Button>
    </div>
  );
}

interface ToolbarProps {
  mode: EditorMode;
  selection: EditorSelection | null;
  onAction: (action: ToolbarAction) => void;
  onSwitchMode: () => void;
  isActive: (mark: string, selection: EditorSelection | null) => boolean;
}

/*
  Actions:
    [] Headings
    [] Bold
    [] Italic
    [] Link
    [] Code
    [] Equation
    [] Blockquote
    [] Lists
        [] Unordered
        [] Ordered
*/

function Toolbar({
  mode,
  selection,
  onAction,
  onSwitchMode,
  isActive,
}: ToolbarProps) {
  function getButtonProps(
    mark: string,
    alt?: string,
  ): {
    type: "button" | "submit" | "reset" | undefined;
    variant:
      | "default"
      | "link"
      | "destructive"
      | "outline"
      | "secondary"
      | "ghost"
      | null
      | undefined;
    className: string;
  } {
    return {
      type: "button",
      variant: "outline",
      className:
        isActive(mark, selection) || isActive(alt ?? "", selection)
          ? "border-input/30 bg-primary! text-primary-foreground shadow-xs hover:bg-primary/50 hover:text-primary-foreground/50"
          : "",
    };
  }

  return (
    <div className="flex flex-row gap-2">
      {/* Text Group */}
      <ButtonGroup>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button {...getButtonProps("heading")}>
              <HeadingIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <Heading1Icon /> Tytuł
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Heading2Icon /> Podtytuł
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Heading3Icon /> Sekcja
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          {...getButtonProps("strong")}
          onClick={(_event) => {
            onAction(boldAction);
          }}
        >
          <BoldIcon />
        </Button>
        <Button {...getButtonProps("emphasis")}>
          <ItalicIcon />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant={"outline"}>
              <LinkIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="gap-2">
            <PopoverHeader>
              <PopoverTitle>Link</PopoverTitle>
              <PopoverDescription>
                Podaj adres linku oraz tekst jaki będzie wyświetlony.
              </PopoverDescription>
            </PopoverHeader>
            <FieldGroup className="mt-2 flex gap-2">
              <Field orientation={"horizontal"}>
                <FieldLabel htmlFor="link-address-input">Adres</FieldLabel>
                <Input id="link-address-input" placeholder="Adres" />
              </Field>
              <Field orientation={"horizontal"}>
                <FieldLabel htmlFor="link-text-input">Tekst</FieldLabel>
                <Input id="link-text-input" placeholder="Tekst" />
              </Field>
              <Button type="button">Dodaj Link</Button>
            </FieldGroup>
          </PopoverContent>
        </Popover>
      </ButtonGroup>
      {/* Blocks Group */}
      <ButtonGroup>
        <Button {...getButtonProps("blockquote")}>
          <QuoteIcon />
        </Button>
        <Button {...getButtonProps("code", "inlineCode")}>
          <CodeIcon />
        </Button>
        <Button {...getButtonProps("math", "inlineMath")}>
          <SigmaIcon />
        </Button>
      </ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button {...getButtonProps("list")}>
            <ListIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>
            <ListIcon /> Nieuporządkowna
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ListOrderedIcon /> Uporządkowana
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Switch Mode */}
      <Field className="ml-auto w-fit" orientation={"horizontal"}>
        <Switch id="switch-editor-mode" />
        <FieldLabel htmlFor="switch-editor-mode">Markdown</FieldLabel>
      </Field>
    </div>
  );
}

function WysiwygSurface() {
  return <></>;
}

interface MarkdownSurfaceProps extends React.ComponentProps<"textarea"> {
  onMarkdownChange: (value: string) => void;
  onSelection: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
}

function MarkdownSurface({
  value,
  onMarkdownChange,
  onChange,
  onPaste,
  onSelection,
  ...props
}: MarkdownSurfaceProps) {
  return (
    <Textarea
      className="relative h-full"
      value={value}
      onChange={(event) => {
        onMarkdownChange(event.target.value);
        onChange?.(event);
      }}
      onSelect={onSelection}
      onPaste={onPaste}
      {...props}
    ></Textarea>
  );
}

export { MarkdownTextarea };
