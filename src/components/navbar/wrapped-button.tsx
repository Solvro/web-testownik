"use client";

import { SparklesIcon } from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { isWrappedPromoActive } from "@/app/wrapped/wrapped.config";
import { ButtonLink } from "@/components/ui/button";
import { PermissionAction } from "@/lib/auth/permissions";

interface WrappedButtonProps {
  onNavigate?: () => void;
}

export function WrappedButton({ onNavigate }: WrappedButtonProps) {
  const { checkPermission } = useContext(AppContext);

  if (
    !isWrappedPromoActive() ||
    !checkPermission(PermissionAction.VIEW_WRAPPED)
  ) {
    return null;
  }

  return (
    <ButtonLink
      href="/wrapped"
      onClick={onNavigate}
      className="relative isolate overflow-hidden border border-orange-200/60 bg-linear-to-br from-violet-500 via-pink-500 to-orange-400 text-white shadow-[0_8px_22px_-14px_rgba(217,70,239,0.95)] duration-300 hover:scale-105 hover:border-orange-100/80 hover:shadow-[0_12px_32px_-12px_rgba(217,70,239,1)] active:scale-95 active:duration-75"
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-br from-orange-400 via-pink-500 to-violet-500 opacity-0 transition-opacity duration-300 group-hover/button:opacity-100"
      />
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 w-full -translate-x-full bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover/button:translate-x-full"
      />
      <SparklesIcon className="transition-transform duration-300 group-hover/button:scale-110 group-hover/button:rotate-12" />
      Wrapped
    </ButtonLink>
  );
}
