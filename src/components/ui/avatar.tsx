"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import * as React from "react";

import { cn } from "@/lib/utils";

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar after:border-border relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  children,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  const colors = [
    "bg-red-200 text-red-800 dark:bg-red-900/20 dark:text-red-300",
    "bg-blue-200 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    "bg-green-200 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    "bg-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
    "bg-purple-200 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
    "bg-pink-200 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300",
    "bg-indigo-200 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300",
    "bg-teal-200 text-teal-800 dark:bg-teal-900/20 dark:text-teal-300",
  ];

  const getColorFromChildren = (children: React.ReactNode) => {
    const text = React.Children.toArray(children)
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");
    let hash = 0;
    for (let index = 0; index < text.length; index++) {
      const char = text.codePointAt(index);
      if (char !== undefined) {
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const color = getColorFromChildren(children);

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs",
        color,
        className,
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group *:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
};
