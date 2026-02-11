"use client";

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const tableVariants = cva(
  "relative w-full overflow-x-auto caption-bottom text-sm text-accent-foreground",
  {
    variants: {
      variant: {
        default: "[&_tbody>tr]:py-2 [&_tbody>tr>td:last-child]:font-normal",
        border:
          "dark:bg-linear-to-r dark:from-(--card-gradient-from)/30 to-(--card-gradient-to) [&_tbody>tr]:bg-card [&_tbody>tr:hover]:bg-ring/20 dark:[&_tbody>tr:hover]:bg-input/20 [&_tbody>tr>td]:py-1.5 [&_tbody>tr>td]:px-2 [&_tbody>tr>td:last-child]:pr-5 [&_tbody>tr>td]:text-base [&_tbody>tr>td:last-child]:text-sm [&_tbody>tr>td]:font-light [&_tbody>tr>td:last-child]:font-thin dark:[&_tbody>tr>td:last-child]:opacity-50 [&_tbody>img]:size-7",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Table({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"table"> & VariantProps<typeof tableVariants>) {
  const wrapperClass =
    variant === "default"
      ? undefined
      : "border border-border rounded-[10px] overflow-hidden";

  return (
    <div data-slot="table-container" className={wrapperClass}>
      <table
        data-slot="table"
        className={cn(tableVariants({ variant, className }))}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
