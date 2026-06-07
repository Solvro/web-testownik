import { sanitizeUrl } from "@braintree/sanitize-url";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import isUrl from "is-url-superb";
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
  Link,
  List,
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
import { toast } from "sonner";
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

const EMPTY_DOCUMENT = unified().use(remarkParse).parse("");

const CALLBACK_TIME = 150;

//region Actions

interface TextFragment {
  value: string;
  marks: string[];
  index: number;
  length: number;
  parent: Parent | null; // A reference to the PharsingParent node, not direct parent
  nodeType?: string;
  comesFromType?: string;
}

function getFragmentsInSelection(
  selection: EditorSelection,
  ast: Root,
  replacedIndicesMap: Map<Parent | null, number[]>,
): TextFragment[] {
  const affectedNodes = nodesInSelection(selection, ast);

  const fragments: TextFragment[] = [];

  let lastPharsingParent: Parent | null = null;

  const marksAccumulator: string[] = [];
  const marksEnds: number[] = [];

  for (const node of affectedNodes) {
    switch (node.type) {
      case "paragraph":
      case "heading":
      case "link": {
        lastPharsingParent = node;
        marksAccumulator.splice(0);
        break;
      }
      case "emphasis":
      case "strong": {
        const index = lastPharsingParent?.children.indexOf(node) ?? -1;
        if (index !== -1) {
          replacedIndicesMap.set(lastPharsingParent, [
            ...(replacedIndicesMap.get(lastPharsingParent) ?? []),
            index,
          ]);
        }

        marksAccumulator.push(node.type);
        marksEnds.push(node.position?.end.offset ?? 0);
        break;
      }
      case "text": {
        const index = lastPharsingParent?.children.indexOf(node) ?? -1;
        if (index !== -1) {
          replacedIndicesMap.set(lastPharsingParent, [
            ...(replacedIndicesMap.get(lastPharsingParent) ?? []),
            index,
          ]);
        }
        if ((node.position?.start.offset ?? 0) >= (marksEnds.at(-1) ?? 0)) {
          marksAccumulator.pop();
          marksEnds.pop();
        }
        const fragment: TextFragment = {
          value: node.value,
          marks: [...marksAccumulator],
          parent: lastPharsingParent,
          index: node.position?.start.offset ?? 0,
          length:
            (node.position?.end.offset ?? 0) -
            (node.position?.start.offset ?? 0),
          comesFromType: node.type,
        };
        fragments.push(fragment);
        break;
      }
      default: {
        break;
      }
    }
  }
  return fragments;
}

function shouldRemoveMark(fragments: TextFragment[], mark: string): boolean {
  return fragments.some((fragment) => fragment.marks.includes(mark));
}

function splitFragmentAt(
  fragment: TextFragment,
  index: number,
): [TextFragment, TextFragment] {
  // Split the fragment to two parts
  const left: TextFragment = {
    value: fragment.value.slice(0, index - fragment.index),
    marks: [...fragment.marks],
    index: fragment.index,
    length: index - fragment.index,
    parent: fragment.parent,
    comesFromType: fragment.comesFromType,
  };
  const right: TextFragment = {
    value: fragment.value.slice(index - fragment.index),
    marks: [...fragment.marks],
    index,
    length: fragment.index + fragment.length - index,
    parent: fragment.parent,
    comesFromType: fragment.comesFromType,
  };
  return [left, right];
}

function splitFragmetsBySelection(
  fragments: TextFragment[],
  selection: EditorSelection,
): void {
  const { anchor, focus } = selection;

  const fragmentInAnchor = fragments.find(
    (fragment) =>
      fragment.index < anchor.offset &&
      fragment.index + fragment.length >= anchor.offset,
  );

  if (fragmentInAnchor !== undefined) {
    // Split the fragment to two parts
    const [left, right] = splitFragmentAt(fragmentInAnchor, anchor.offset);

    // Find and replace the fragment with left and right parts
    const index = fragments.indexOf(fragmentInAnchor);

    // Fix leading space
    const spaceCount = /^\s+/.exec(right.value)?.[0].length ?? 0;
    if (spaceCount > 0) {
      left.value += right.value.slice(0, spaceCount);
      left.length += spaceCount;
      right.value = right.value.slice(spaceCount);
      right.index += spaceCount;
      right.length -= spaceCount;
    }

    fragments.splice(index, 1, left, right);
  }

  const fragmentInFocus = fragments.find(
    (fragment) =>
      fragment.index <= focus.offset &&
      fragment.index + fragment.length > focus.offset,
  );

  if (fragmentInFocus !== undefined) {
    // Split the fragment to two parts
    const [left, right] = splitFragmentAt(fragmentInFocus, focus.offset);

    // Fix trailing space
    const spaceCount = /\s+$/.exec(left.value)?.[0].length ?? 0;
    if (spaceCount > 0) {
      right.value = left.value.slice(-spaceCount) + right.value;
      right.index -= spaceCount;
      right.length += spaceCount;
      left.value = left.value.slice(0, -spaceCount);
      left.length -= spaceCount;
    }

    // Find and replace the fragment with left and right parts
    const index = fragments.indexOf(fragmentInFocus);
    fragments.splice(index, 1, left, right);
  }
}

function selectFragmentsFromSelection(
  fragments: TextFragment[],
  selection: EditorSelection,
): TextFragment[] {
  if (fragments.length <= 1) {
    return fragments;
  }

  const { anchor, focus } = selection;
  const selected: TextFragment[] = [];

  for (const fragment of fragments) {
    if (
      fragment.index + fragment.length <= focus.offset &&
      fragment.index >= anchor.offset
    ) {
      selected.push(fragment);
    }
  }

  return selected;
}

function applyMarkToFragmentsInSelection(
  fragments: TextFragment[],
  selection: EditorSelection,
  mark: string,
): void {
  const { anchor, focus } = selection;

  for (const fragment of fragments) {
    if (
      fragment.index >= anchor.offset &&
      fragment.index + fragment.length - 1 < focus.offset &&
      !fragment.marks.includes(mark) &&
      !/^\s+$/gm.test(fragment.value)
    ) {
      fragment.marks.push(mark);
    }
  }
}

function removeMarkFromFragmentsInSelection(
  fragments: TextFragment[],
  selection: EditorSelection,
  mark: string,
): void {
  const { anchor, focus } = selection;

  for (const fragment of fragments) {
    const index = fragment.marks.indexOf(mark);
    if (
      fragment.index >= anchor.offset &&
      fragment.index + fragment.length - 1 < focus.offset &&
      index !== -1
    ) {
      fragment.marks.splice(index, 1);
    }
  }
}

function cleanFragments(fragments: TextFragment[]): void {
  let index = 1;
  let fragment: TextFragment | undefined = fragments.at(0);
  if (fragment === undefined) {
    return;
  }
  while (index < fragments.length) {
    const next = fragments.at(index);
    if (next === undefined) {
      break;
    }
    const containSameMarksAndParent =
      fragment.parent === next.parent &&
      fragment.marks.length === next.marks.length &&
      fragment.marks.every(
        (element, index_) => element === next.marks.at(index_),
      );
    if (containSameMarksAndParent) {
      fragment.value += next.value;
      fragment.length += next.length;
      fragments.splice(index, 1);
    } else {
      fragment = next;
      index++;
    }
  }
}

function sanitizeFragments(fragments: TextFragment[]): void {
  for (let index = 0; index < fragments.length; index++) {
    const current = fragments[index];

    // We only care about fragments that actually have active styling marks
    if (current.marks.length === 0 || current.value === "") {
      continue;
    }

    // 1. Handle Leading Spaces (e.g., marks: ['strong'], value: " Lorem")
    const leadingSpaces = /^\s+/.exec(current.value)?.[0] ?? "";
    if (leadingSpaces.length > 0) {
      // Look at the node to the left
      const previous = fragments[index - 1];
      if (previous.parent === current.parent && previous.marks.length === 0) {
        // Safe to push the space into the unformatted node on the left
        previous.value += leadingSpaces;
        previous.length += leadingSpaces.length;
        current.value = current.value.slice(leadingSpaces.length);
        current.length -= leadingSpaces.length;
      } else {
        // No unformatted node exists on the left; break the spaces out into a new unformatted fragment
        const spaceFragment: TextFragment = {
          value: leadingSpaces,
          marks: [], // Strip marks
          parent: current.parent,
          index: current.index,
          length: leadingSpaces.length,
        };
        current.value = current.value.slice(leadingSpaces.length);
        current.index += leadingSpaces.length;
        current.length -= leadingSpaces.length;

        fragments.splice(index, 0, spaceFragment);
        index++; // Offset the loop pointer because we mutated the array length
      }
    }

    // 2. Handle Trailing Spaces (e.g., marks: ['strong'], value: "Ipsum ")
    const trailingSpaces = /\s+$/.exec(current.value)?.[0] ?? "";
    if (trailingSpaces.length > 0) {
      // Look at the node to the right
      const next = fragments[index + 1];
      if (next.parent === current.parent && next.marks.length === 0) {
        // Safe to prepend the space into the unformatted node on the right
        next.value = trailingSpaces + next.value;
        next.index -= trailingSpaces.length;
        next.length += trailingSpaces.length;
        current.value = current.value.slice(0, -trailingSpaces.length);
        current.length -= trailingSpaces.length;
      } else {
        // Create an unformatted text slot on the right to contain the trailing space securely
        const spaceFragment: TextFragment = {
          value: trailingSpaces,
          marks: [], // Strip marks
          parent: current.parent,
          index: current.index + current.length - trailingSpaces.length,
          length: trailingSpaces.length,
        };
        current.value = current.value.slice(0, -trailingSpaces.length);
        current.length -= trailingSpaces.length;

        fragments.splice(index + 1, 0, spaceFragment);
        index++; // Skip evaluating the newly added space block
      }
    }
  }
}

function groupFragmentsByParent(
  fragments: TextFragment[],
): Map<Parent | null, TextFragment[]> {
  const map = new Map<Parent | null, TextFragment[]>();
  for (const fragment of fragments) {
    const parent = fragment.parent;
    if (!map.has(parent)) {
      map.set(parent, []);
    }
    map.get(parent)?.push(fragment);
  }
  return map;
}

function createNodesFromFragments(fragments: TextFragment[]): Node[] {
  const nodes: Node[] = [];

  let parentNode: Parent | null = null;

  for (const fragment of fragments) {
    // Check for marks and create/join
    while (fragment.marks.length > 0) {
      const mark: string = fragment.marks.pop() ?? "";
      const last = nodes.at(-1);
      if (last?.type === mark) {
        // Join with previous node
        parentNode = last as Parent;
      } else {
        // Create new node
        const newNode: Parent = {
          type: mark,
          children: [],
        };

        if (newNode.type === "inlineCode" || newNode.type === "code") {
          (newNode as Node as InlineCode).value = fragment.value;
        }

        if (parentNode === null) {
          nodes.push(newNode);
        } else {
          parentNode.children.push(newNode as RootContent);
        }

        parentNode = newNode;
      }
    }

    const textNode: Text = {
      type: "text",
      value: fragment.value,
    };

    if (parentNode === null) {
      nodes.push(textNode);
    } else {
      parentNode.children.push(textNode);
    }

    parentNode = null;
  }

  return nodes;
}

function isMultiline(fragments: TextFragment[]): boolean {
  // Check for multiple parents
  let index = 1;
  while (index < fragments.length) {
    if (fragments[index - 1].parent !== fragments[index].parent) {
      return true;
    }
    index++;
  }

  // Check for new line characters
  for (const fragment of fragments) {
    if (/\n/g.test(fragment.value)) {
      return true;
    }
  }

  return false;
}

const boldAction: ToolbarAction = {
  apply: (ast: Root, selection: EditorSelection): Root => {
    // Split AST to text fragments
    // Apply change to fragments, and potentailly create new ones
    // Reconstruct AST

    // Get text fragments in selection
    const replacedIndicesMap = new Map<Parent | null, number[]>(); // A reference for which nodes to replace when reconstructing the AST
    const fragments = getFragmentsInSelection(
      selection,
      ast,
      replacedIndicesMap,
    );

    // Determine whether we need to remove the mark
    const remove = shouldRemoveMark(fragments, "strong");

    if (remove) {
      // Split fragments by selection boundaries
      splitFragmetsBySelection(fragments, selection);
      // Remove mark from fragments
      removeMarkFromFragmentsInSelection(fragments, selection, "strong");
      // Merge neighbouring fragments
      cleanFragments(fragments);
    } else {
      // Split fragments by selection boundaries
      splitFragmetsBySelection(fragments, selection);
      // Apply 'strong' mark to fragments
      applyMarkToFragmentsInSelection(fragments, selection, "strong");
    }

    sanitizeFragments(fragments);

    cleanFragments(fragments);

    // Group fragments by their parent node
    const grouped = groupFragmentsByParent(fragments);

    // Create new nodes from fragments per parent
    for (const [parent, childrenFragments] of grouped.entries()) {
      const newNodes = createNodesFromFragments(childrenFragments);
      const replacedIndices = replacedIndicesMap.get(parent) ?? [];
      parent?.children.splice(
        Math.min(...replacedIndices),
        replacedIndices.length,
        ...(newNodes as RootContent[]),
      );
    }

    return ast;
  },
};

const italicAction: ToolbarAction = {
  apply: (ast: Root, selection: EditorSelection): Root => {
    // Split AST to text fragments
    // Apply change to fragments, and potentailly create new ones
    // Reconstruct AST

    // Get text fragments in selection
    const replacedIndicesMap = new Map<Parent | null, number[]>(); // A reference for which nodes to replace when reconstructing the AST
    const fragments = getFragmentsInSelection(
      selection,
      ast,
      replacedIndicesMap,
    );

    // Determine whether we need to remove the mark
    const remove = shouldRemoveMark(fragments, "emphasis");

    if (remove) {
      // Split fragments by selection boundaries
      splitFragmetsBySelection(fragments, selection);
      // Remove mark from fragments
      removeMarkFromFragmentsInSelection(fragments, selection, "emphasis");
      // Merge neighbouring fragments
      cleanFragments(fragments);
    } else {
      // Split fragments by selection boundaries
      splitFragmetsBySelection(fragments, selection);
      // Apply 'strong' mark to fragments
      applyMarkToFragmentsInSelection(fragments, selection, "emphasis");
    }

    sanitizeFragments(fragments);

    cleanFragments(fragments);

    // Group fragments by their parent node
    const grouped = groupFragmentsByParent(fragments);

    // Create new nodes from fragments per parent
    for (const [parent, childrenFragments] of grouped.entries()) {
      const newNodes = createNodesFromFragments(childrenFragments);
      const replacedIndices = replacedIndicesMap.get(parent) ?? [];
      parent?.children.splice(
        Math.min(...replacedIndices),
        replacedIndices.length,
        ...(newNodes as RootContent[]),
      );
    }

    return ast;
  },
};

const headingAction = (depth: 1 | 2 | 3): ToolbarAction => {
  return {
    apply: (ast: Root, selection: EditorSelection): Root => {
      const replacedIndicesMap = new Map<Parent | null, number[]>(); // A reference for which nodes to replace when reconstructing the AST
      const fragments = getFragmentsInSelection(
        selection,
        ast,
        replacedIndicesMap,
      );

      if (fragments.length === 0) {
        return ast;
      }

      const uniqueParents = new Set<Parent>();
      for (const fragment of fragments) {
        if (fragment.parent !== null) {
          uniqueParents.add(fragment.parent);
        }
      }

      for (const parentNode of uniqueParents) {
        // 1. Cast to RootContent so we can inspect the block node cleanly
        const blockNode = parentNode as RootContent;

        if (blockNode.type === "heading") {
          if (blockNode.depth === depth) {
            // TOGGLE OFF: Create a completely fresh Paragraph object configuration
            const children = blockNode.children; // Save the reference to the children array

            // Reassign the properties by wiping the old heading shape entirely
            const paragraphNode = blockNode as unknown as Paragraph;
            paragraphNode.type = "paragraph";
            paragraphNode.children = children;

            // Safely drop the depth key now that the compiler knows it's a structural Paragraph shape
            delete (paragraphNode as any).depth;
          } else {
            // SWITCH LEVEL: Change from H1 to H2, H3, etc.
            blockNode.depth = depth;
          }
        } else if (blockNode.type === "paragraph") {
          // TOGGLE ON: Turn a paragraph into a heading configuration block shape
          const children = blockNode.children;
          const headingNode = blockNode as unknown as Heading;

          headingNode.type = "heading";
          headingNode.depth = depth;
          headingNode.children = children;
        }
      }

      return ast;
    },
  };
};

const linkAction = (text: string, url: string): ToolbarAction => {
  return {
    apply: (ast: Root, selection: EditorSelection): Root => {
      return ast;
    },
  };
};

const quoteAction: ToolbarAction = {
  apply(ast: Root, selection: EditorSelection): Root {
    return ast;
  },
};

const codeAction: ToolbarAction = {
  apply(ast: Root, selection: EditorSelection): Root {
    const replacedIndicesMap = new Map<Parent | null, number[]>();
    const fragments = getFragmentsInSelection(
      selection,
      ast,
      replacedIndicesMap,
    );

    splitFragmetsBySelection(fragments, selection);

    const selectedFragments = selectFragmentsFromSelection(
      fragments,
      selection,
    );

    if (selectedFragments.length === 0) return ast;

    const multiline = isMultiline(selectedFragments);
    const markType = multiline ? "code" : "inlineCode";

    // Remove path — if already wrapped in this mark type, unwrap
    const remove = shouldRemoveMark(selectedFragments, markType);

    if (remove) {
      removeMarkFromFragmentsInSelection(fragments, selection, markType);
      cleanFragments(fragments);
      sanitizeFragments(fragments);
      cleanFragments(fragments);

      const grouped = groupFragmentsByParent(fragments);
      for (const [parent, childFragments] of grouped.entries()) {
        const newNodes = createNodesFromFragments(childFragments);
        const indices = replacedIndicesMap.get(parent) ?? [];
        if (indices.length === 0) continue;
        parent?.children.splice(
          Math.min(...indices),
          indices.length,
          ...(newNodes as RootContent[]),
        );
      }

      return ast;
    }

    if (multiline) {
      let text = "";
      let lastParent: Parent | null = null;

      for (const fragment of selectedFragments) {
        if (lastParent !== null && fragment.parent !== lastParent) {
          text += "\n";
        }
        text += fragment.value;
        lastParent = fragment.parent;
      }

      const codeNode = {
        type: "code",
        value: text,
        lang: null,
        meta: null,
      } as unknown as RootContent;

      const rootChildren = ast.children;

      // Find block-level parents of first and last selected fragment
      function findBlockParent(node: Node): RootContent | null {
        for (const child of rootChildren) {
          function contains(n: Node, target: Node): boolean {
            if (n === target) return true;
            if ("children" in n)
              return (n as Parent).children.some((c) => contains(c, target));
            return false;
          }
          if (
            child === node ||
            ("children" in child && contains(child, node))
          ) {
            return child;
          }
        }
        return null;
      }

      const firstBlockParent = findBlockParent(
        selectedFragments[0].parent as unknown as Node,
      );
      const lastBlockParent = findBlockParent(
        selectedFragments.at(-1)!.parent as unknown as Node,
      );

      if (firstBlockParent === null || lastBlockParent === null) return ast;

      const firstParentIndex = rootChildren.indexOf(firstBlockParent);
      const lastParentIndex = rootChildren.indexOf(lastBlockParent);

      if (firstParentIndex === -1 || lastParentIndex === -1) return ast;

      // Get ALL inline children of first block before selection
      // by collecting from the block node directly, not from fragments
      const selectionStart = selectedFragments[0].index;
      const selectionEnd =
        selectedFragments.at(-1)!.index + selectedFragments.at(-1)!.length;

      function getNodesBeforeOffset(
        parent: RootContent,
        offset: number,
      ): RootContent[] {
        if (!("children" in parent)) return [];
        const result: RootContent[] = [];
        for (const child of (parent as Parent).children) {
          const childEnd = child.position?.end.offset ?? 0;
          if (childEnd <= offset) {
            result.push(child as RootContent);
          } else if ((child.position?.start.offset ?? 0) < offset) {
            // partially overlapping — take the text portion before offset
            if (child.type === "text") {
              const textChild = child as Text;
              const localEnd = offset - (child.position?.start.offset ?? 0);
              if (localEnd > 0) {
                result.push({
                  type: "text",
                  value: textChild.value.slice(0, localEnd).trimEnd(),
                } as unknown as RootContent);
              }
            }
          }
        }
        return result;
      }

      function getNodesAfterOffset(
        parent: RootContent,
        offset: number,
      ): RootContent[] {
        if (!("children" in parent)) return [];
        const result: RootContent[] = [];
        for (const child of (parent as Parent).children) {
          const childStart = child.position?.start.offset ?? 0;
          if (childStart >= offset) {
            result.push(child as RootContent);
          } else if ((child.position?.end.offset ?? 0) > offset) {
            // partially overlapping — take the text portion after offset
            if (child.type === "text") {
              const textChild = child as Text;
              const localStart = offset - (child.position?.start.offset ?? 0);
              const sliced = textChild.value.slice(localStart).trimStart();
              if (sliced.length > 0) {
                result.push({
                  type: "text",
                  value: sliced,
                } as unknown as RootContent);
              }
            }
          }
        }
        return result;
      }

      const beforeNodes = getNodesBeforeOffset(
        firstBlockParent,
        selectionStart,
      );
      const afterNodes = getNodesAfterOffset(lastBlockParent, selectionEnd);

      const replacementNodes: RootContent[] = [];

      if (beforeNodes.length > 0) {
        replacementNodes.push({
          type: "paragraph",
          children: beforeNodes,
        } as unknown as RootContent);
      }

      replacementNodes.push(codeNode);

      if (afterNodes.length > 0) {
        replacementNodes.push({
          type: "paragraph",
          children: afterNodes,
        } as unknown as RootContent);
      }

      rootChildren.splice(
        firstParentIndex,
        lastParentIndex - firstParentIndex + 1,
        ...replacementNodes,
      );
    } else {
      const text = selectedFragments.map((f) => f.value).join("");

      if (text.length === 0) return ast;

      const codeFragment: TextFragment = {
        value: text,
        marks: ["inlineCode"],
        index: selectedFragments[0].index,
        length: text.length,
        parent: selectedFragments[0].parent,
      };

      const firstIndex = fragments.indexOf(selectedFragments[0]);
      if (firstIndex === -1) return ast;

      fragments.splice(firstIndex, selectedFragments.length, codeFragment);

      sanitizeFragments(fragments);
      cleanFragments(fragments);

      const grouped = groupFragmentsByParent(fragments);

      for (const [parent, childFragments] of grouped.entries()) {
        const newNodes = createNodesFromFragments(childFragments);
        const indices = replacedIndicesMap.get(parent) ?? [];
        if (indices.length === 0) continue;
        parent?.children.splice(
          Math.min(...indices),
          indices.length,
          ...(newNodes as RootContent[]),
        );
      }
    }

    return ast;
  },
};

const mathAction: ToolbarAction = {
  apply(ast: Root, selection: EditorSelection): Root {
    return ast;
  },
};

const listAction = (ordered: boolean): ToolbarAction => {
  return {
    apply: (ast: Root, selection: EditorSelection) => {
      return ast;
    },
  };
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

interface Mark {
  type: string;
  depth?: number;
  ordered?: boolean;
}

function areMarksEqual(a: Mark, b: Mark): boolean {
  return a.type === b.type && a.depth === b.depth && a.ordered === b.ordered;
}

function hasMarkType(mark: string, marks: Mark[]): boolean {
  return marks.some((element) => element.type === mark);
}

function hasMark(mark: Mark, marks: Mark[]): boolean {
  return marks.some((element) => areMarksEqual(element, mark));
}

function getMark(mark: string, marks: Mark[]): Mark[] {
  return marks.filter((element) => element.type === mark);
}

function getActiveMarks(nodes: Node[]): Mark[] {
  const marks: Mark[] = [];
  for (const node of nodes) {
    if (isStylingMark(node)) {
      const mark: Mark = { type: node.type };
      switch (node.type) {
        case "heading": {
          mark.depth = (node as Heading).depth;
          break;
        }
        case "list": {
          mark.ordered = (node as List).ordered ?? false;
          break;
        }
        default: {
          break;
        }
      }
      marks.push(mark);
    }
  }

  return marks.filter((element, index, self) => {
    const firstOccuranceIndex = self.findIndex((otherElement) => {
      return areMarksEqual(element, otherElement);
    });
    return index === firstOccuranceIndex;
  });
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
  value,
  ...props
}: React.ComponentProps<"textarea">) {
  const [ast, setAST] = useState<Root>(parseToAST(value as string));
  const [markdown, setMarkdown] = useState<string>(value as string);
  const [mode, setMode] = useState<EditorMode>("WYSIWYG");
  const [selection, setSelection] = useState<EditorSelection | null>(null);

  function parseToAST(value_: string): Root {
    return unified().use(remarkParse).use(remarkMath).parse(value_);
  }

  const parse = useDebouncedCallback(
    (value_: string) => {
      const tree = unified().use(remarkParse).use(remarkMath).parse(value_);
      setAST(tree);
    },
    { wait: CALLBACK_TIME },
  );

  const stringify = (ast_: Root): string => {
    return unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkStringify, {
        unsafe: [],
      })
      .stringify(ast_);
  };

  function applyAction(action: ToolbarAction) {
    if (selection === null) {
      return;
    }

    const freshAST = parseToAST(markdown);
    const mutatedAST = action.apply(freshAST, selection);

    const newMarkdown = stringify(mutatedAST);
    const cleanASTWithOffsets = parseToAST(newMarkdown);

    setAST(cleanASTWithOffsets);
    setMarkdown(newMarkdown);

    onChange?.({
      target: { value: newMarkdown },
    } as React.ChangeEvent<HTMLTextAreaElement>);
  }

  function handleMarkdownChange(value_: string) {
    setMarkdown(value_);
    parse(value_);
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
    const value_ = textarea.value;
    const length = value_.length;

    const startIndex = textarea.selectionStart;
    const endIndex = textarea.selectionEnd;

    const newLineIndicies = [...value_.matchAll(/\n/g)].map(
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
        ...newLineIndicies.filter((value__, _index) => value__ < startIndex),
        -1,
      );
    const endColumn =
      endIndex -
      Math.max(
        ...newLineIndicies.filter((value__, _index) => value__ < endIndex),
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

  function getMarksInSelection(selection_: EditorSelection | null): Mark[] {
    if (selection_ === null) {
      return [];
    }
    return getActiveMarks(nodesInSelection(selection_, ast));
  }

  return (
    <div className="flex flex-col gap-2">
      <Toolbar
        mode={mode}
        selection={selection}
        onAction={applyAction}
        onSwitchMode={switchMode}
        getActive={getMarksInSelection}
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
    </div>
  );
}

interface ToolbarProps {
  mode: EditorMode;
  selection: EditorSelection | null;
  onAction: (action: ToolbarAction) => void;
  onSwitchMode: () => void;
  getActive: (selection: EditorSelection | null) => Mark[];
}

function Toolbar({
  mode,
  selection,
  onAction,
  onSwitchMode,
  getActive,
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
        hasMarkType(mark, getActive(selection)) ||
        hasMarkType(alt ?? "", getActive(selection))
          ? "border-input/30 bg-primary! text-primary-foreground shadow-xs hover:bg-primary/50 hover:text-primary-foreground/50"
          : "",
    };
  }

  function getDropdownItemProps(mark: Mark): {
    className: string;
  } {
    return {
      className: hasMark(mark, getActive(selection)) ? "font-bold" : "",
    };
  }

  function getIconProps(mark: Mark): {
    strokeWidth: number;
  } {
    return {
      strokeWidth: hasMark(mark, getActive(selection)) ? 3 : 2,
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
          <DropdownMenuContent align="start" className="flex flex-col gap-1">
            <DropdownMenuItem
              {...getDropdownItemProps({ type: "heading", depth: 1 })}
              onClick={(_event) => {
                onAction(headingAction(1));
              }}
            >
              <Heading1Icon {...getIconProps({ type: "heading", depth: 1 })} />{" "}
              Tytuł
            </DropdownMenuItem>
            <DropdownMenuItem
              {...getDropdownItemProps({ type: "heading", depth: 2 })}
              onClick={(_event) => {
                onAction(headingAction(2));
              }}
            >
              <Heading2Icon {...getIconProps({ type: "heading", depth: 2 })} />{" "}
              Podtytuł
            </DropdownMenuItem>
            <DropdownMenuItem
              {...getDropdownItemProps({ type: "heading", depth: 3 })}
              onClick={(_event) => {
                onAction(headingAction(3));
              }}
            >
              <Heading3Icon {...getIconProps({ type: "heading", depth: 3 })} />{" "}
              Sekcja
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
        <Button
          {...getButtonProps("emphasis")}
          onClick={(_event) => {
            onAction(italicAction);
          }}
        >
          <ItalicIcon />
        </Button>
        <LinkActionButton onAction={onAction} />
      </ButtonGroup>
      {/* Blocks Group */}
      <ButtonGroup>
        <Button {...getButtonProps("blockquote")}>
          <QuoteIcon />
        </Button>
        <Button
          {...getButtonProps("code", "inlineCode")}
          onClick={(_event) => {
            onAction(codeAction);
          }}
        >
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
          <DropdownMenuItem
            {...getDropdownItemProps({ type: "list", ordered: false })}
          >
            <ListIcon /> Nieuporządkowna
          </DropdownMenuItem>
          <DropdownMenuItem
            {...getDropdownItemProps({ type: "list", ordered: true })}
          >
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

interface LinkActionButtonProps {
  onAction: (action: ToolbarAction) => void;
}

function LinkActionButton({ onAction }: LinkActionButtonProps) {
  const [url, setUrl] = useState<string>("");
  const [text, setText] = useState<string>("");

  function createLink(): void {
    if (isUrl(url)) {
      onAction(linkAction(text, sanitizeUrl(url)));
    } else {
      toast.error("Niewłaściwy link", {
        description:
          "Każdy link musi rozpoczynać się z 'https://' lub 'http://'.",
      });
    }
  }

  return (
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
            <Input
              id="link-address-input"
              placeholder="Adres"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
            />
          </Field>
          <Field orientation={"horizontal"}>
            <FieldLabel htmlFor="link-text-input">Tekst</FieldLabel>
            <Input
              type="url"
              id="link-text-input"
              placeholder="Tekst"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </Field>
          <Button
            type="button"
            onClick={(_event) => {
              createLink();
            }}
          >
            Dodaj Link
          </Button>
        </FieldGroup>
      </PopoverContent>
    </Popover>
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
