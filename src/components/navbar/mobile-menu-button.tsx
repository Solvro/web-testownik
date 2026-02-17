"use client";

import { MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MobileMenuButtonProps {
  expanded: boolean;
  onToggle: () => void;
}

export function MobileMenuButton({
  expanded,
  onToggle,
}: MobileMenuButtonProps) {
  return (
    <Button
      aria-label="Menu"
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={onToggle}
    >
      {expanded ? (
        <XIcon className="size-6" />
      ) : (
        <MenuIcon className="size-6" />
      )}
    </Button>
  );
}
