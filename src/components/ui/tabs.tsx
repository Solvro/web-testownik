"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tabsVariants = cva("", {
  variants: {
    variant: {
      default: "flex flex-col gap-2",
      quiz: [
        "flex flex-col w-full gap-4 md:flex-row md:gap-6",
        // TabsList
        "**:data-[slot=tabs-list]:border-none **:data-[slot=tabs-list]:flex **:data-[slot=tabs-list]:h-min **:data-[slot=tabs-list]:gap-2 **:data-[slot=tabs-list]:items-stretch **:data-[slot=tabs-list]:flex-col md:**:data-[slot=tabs-list]:flex-col **:data-[slot=tabs-list]:bg-transparent **:data-[slot=tabs-list]:w-full md:**:data-[slot=tabs-list]:w-64 **:data-[slot=tabs-list]:overflow-x-auto md:**:data-[slot=tabs-list]:overflow-x-visible",
        // TabsTrigger
        "**:data-[slot=tabs-trigger]:gap-2 **:data-[slot=tabs-trigger]:transition-all **:data-[slot=tabs-trigger]:text-sm md:**:data-[slot=tabs-trigger]:text-base **:data-[slot=tabs-trigger]:px-3 **:data-[slot=tabs-trigger]:py-2.5 **:data-[slot=tabs-trigger]:flex **:data-[slot=tabs-trigger]:justify-center md:**:data-[slot=tabs-trigger]:justify-start **:data-[slot=tabs-trigger]:border **:data-[slot=tabs-trigger]:border-input **:data-[slot=tabs-trigger]:text-foreground! **:data-[slot=tabs-trigger]:duration-300 **:data-[slot=tabs-trigger]:aria-selected:bg-ring! **:data-[slot=tabs-trigger]:font-light **:data-[slot=tabs-trigger]:flex-1 md:**:data-[slot=tabs-trigger]:flex-initial",
        // Icons inside TabsTrigger
        "[&>svg]:size-6",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Tabs({
  className,
  orientation = "horizontal",
  variant = "default",
  ...props
}: TabsPrimitive.Root.Props & VariantProps<typeof tabsVariants>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      data-variant={variant}
      className={cn(tabsVariants({ variant }), className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  // eslint-disable-next-line react-refresh/only-export-components
  tabsListVariants,
  // eslint-disable-next-line react-refresh/only-export-components
  tabsVariants,
};
