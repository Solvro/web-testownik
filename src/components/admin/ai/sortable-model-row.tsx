"use client";

import type { Instruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import {
  attachInstruction,
  extractInstruction,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ModelReorderOperation = Exclude<
  Instruction["operation"],
  "combine"
>;

export function SortableModelRow({
  modelId,
  label,
  modelCode,
  listId,
  previousId,
  nextId,
  onMove,
  children,
}: {
  modelId: string;
  label: string;
  modelCode: string;
  listId: string;
  previousId?: string;
  nextId?: string;
  onMove: (
    sourceId: string,
    targetId: string,
    operation: ModelReorderOperation,
  ) => void;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [previewContainer, setPreviewContainer] = useState<HTMLElement | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [instruction, setInstruction] = useState<Instruction | null>(null);

  useEffect(() => {
    const element = rowRef.current;
    const dragHandle = handleRef.current;
    if (element === null || dragHandle === null) {
      return;
    }
    return combine(
      draggable({
        element,
        dragHandle,
        getInitialData: () => ({ type: "ai-model", modelId, listId }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({ x: "12px", y: "8px" }),
            render: ({ container }) => {
              setPreviewContainer(container);
              return () => {
                setPreviewContainer(null);
              };
            },
          });
        },
        onDragStart: () => {
          setMenuOpen(false);
          setDragging(true);
        },
        onDrop: () => {
          setDragging(false);
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.type === "ai-model" &&
          source.data.listId === listId &&
          source.data.modelId !== modelId,
        getData: ({ input }) =>
          attachInstruction(
            { modelId },
            {
              element,
              input,
              operations: {
                "reorder-before": "available",
                "reorder-after": "available",
              },
            },
          ),
        onDragEnter: ({ self }) => {
          setInstruction(extractInstruction(self.data));
        },
        onDrag: ({ self }) => {
          setInstruction(extractInstruction(self.data));
        },
        onDragLeave: () => {
          setInstruction(null);
        },
        onDrop: ({ source, self }) => {
          setInstruction(null);
          const dropInstruction = extractInstruction(self.data);
          if (
            typeof source.data.modelId === "string" &&
            dropInstruction !== null &&
            !dropInstruction.blocked &&
            dropInstruction.operation !== "combine"
          ) {
            onMove(source.data.modelId, modelId, dropInstruction.operation);
          }
        },
      }),
    );
  }, [modelId, listId, onMove]);

  return (
    <>
      <TableRow
        ref={rowRef}
        data-dragging={dragging || undefined}
        data-drop-operation={instruction?.operation}
        className={cn("relative", dragging && "opacity-40")}
      >
        <TableCell className="px-2 text-center">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              onMouseDown={(event) => {
                // Opening on mousedown steals the pointer before native dragging can start.
                event.preventBaseUIHandler();
              }}
              onClick={(event) => {
                event.preventBaseUIHandler();
                setMenuOpen((open) => !open);
              }}
              render={
                <Button
                  ref={handleRef}
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Zmień kolejność modelu ${label}`}
                  title="Przeciągnij lub otwórz menu kolejności"
                  className="cursor-grab active:cursor-grabbing"
                >
                  <GripVerticalIcon />
                </Button>
              }
            />
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem
                disabled={previousId === undefined}
                onClick={() => {
                  if (previousId !== undefined) {
                    onMove(modelId, previousId, "reorder-before");
                  }
                }}
              >
                <ArrowUpIcon />
                Przenieś w górę
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={nextId === undefined}
                onClick={() => {
                  if (nextId !== undefined) {
                    onMove(modelId, nextId, "reorder-after");
                  }
                }}
              >
                <ArrowDownIcon />
                Przenieś w dół
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {instruction !== null && (
            <div
              aria-hidden="true"
              data-slot="model-drop-indicator"
              className={cn(
                "bg-primary pointer-events-none absolute inset-x-0 z-10 h-0.5",
                instruction.operation === "reorder-before"
                  ? "top-0 -translate-y-1/2"
                  : "translate-y-1/2",
                // Rows have a 1px bottom border, except the final row.
                instruction.operation === "reorder-after" &&
                  (nextId === undefined ? "bottom-0" : "-bottom-px"),
              )}
            />
          )}
        </TableCell>
        {children}
      </TableRow>
      {previewContainer === null
        ? null
        : createPortal(
            <div
              className="bg-popover text-popover-foreground flex w-64 items-center gap-3 rounded-lg border p-3 shadow-md"
              aria-hidden="true"
            >
              <GripVerticalIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{label}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {modelCode}
                </p>
              </div>
            </div>,
            previewContainer,
          )}
    </>
  );
}
