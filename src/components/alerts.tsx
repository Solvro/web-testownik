"use client";

import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import {
  InfoIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { cn } from "@/lib/utils";

interface SolvroAlert {
  id: string;
  title: string;
  content: string;
  alert_type: "info" | "warning" | "critical";
  link: string;
  is_global: boolean;
  is_dismissable: boolean;
  start_at: string | null;
  end_at: string | null;
}

const ALERTS_ENDPOINT = "https://alerts.solvro.pl/api/v1/alerts/";
const DISMISSED_STORAGE_KEY = "solvro-alerts-dismissed";

const ALLOWED_TAGS = [
  "a",
  "b",
  "em",
  "i",
  "strong",
  "u",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
];
const ALLOWED_ATTR = ["href", "title", "target", "rel"];

const VARIANT_STYLES: Record<SolvroAlert["alert_type"], string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900 [&>svg]:text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100 dark:[&>svg]:text-blue-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:[&>svg]:text-amber-300",
  critical:
    "border-red-200 bg-red-50 text-red-900 [&>svg]:text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100 dark:[&>svg]:text-red-300",
};

const VARIANT_ICONS: Record<SolvroAlert["alert_type"], typeof InfoIcon> = {
  info: InfoIcon,
  warning: TriangleAlertIcon,
  critical: OctagonAlertIcon,
};

function readDismissedIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (stored === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function persistDismissedIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids));
}

function isExternalLink(link: string): boolean {
  if (typeof window === "undefined") {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(link);
  }
  try {
    return (
      new URL(link, window.location.href).origin !== window.location.origin
    );
  } catch {
    return false;
  }
}

async function fetchAlerts(appCode: string): Promise<SolvroAlert[]> {
  const url = `${ALERTS_ENDPOINT}?app=${encodeURIComponent(appCode)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (response.status === 400) {
    throw new Error(
      `Solvro Alerts: unknown app code "${appCode}". Set NEXT_PUBLIC_ALERTS_APP_CODE to the slug registered for this app.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Solvro Alerts: request failed (${String(response.status)})`,
    );
  }

  const payload: unknown = await response.json();
  return Array.isArray(payload) ? (payload as SolvroAlert[]) : [];
}

export function Alerts(): React.JSX.Element | null {
  const appCode = env.NEXT_PUBLIC_ALERTS_APP_CODE;

  const { data, error } = useQuery({
    queryKey: ["solvro-alerts", appCode],
    queryFn: async () => fetchAlerts(appCode),
    staleTime: 60_000,
    gcTime: 60_000,
    retry: false,
  });

  const [dismissedIds, setDismissedIds] = useState<string[]>(readDismissedIds);

  useEffect(() => {
    if (error !== null) {
      console.error(error);
    }
  }, [error]);

  const dismissAlert = (id: string) => {
    setDismissedIds((previous) => {
      if (previous.includes(id)) {
        return previous;
      }
      const next = [...previous, id];
      persistDismissedIds(next);
      return next;
    });
  };

  const visible = (data ?? []).filter(
    (alert) => !alert.is_dismissable || !dismissedIds.includes(alert.id),
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {visible.map((alert) => {
        const Icon = VARIANT_ICONS[alert.alert_type];
        const safeContent = DOMPurify.sanitize(alert.content, {
          ALLOWED_TAGS,
          ALLOWED_ATTR,
        });
        const hasLink = alert.link !== "";
        const external = hasLink && isExternalLink(alert.link);

        const body = (
          <Alert
            className={cn(
              "relative pr-10",
              VARIANT_STYLES[alert.alert_type],
              hasLink && "cursor-pointer transition-opacity hover:opacity-90",
            )}
          >
            <Icon />
            {alert.is_dismissable ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zamknij"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dismissAlert(alert.id);
                }}
                className="absolute top-0 right-0 m-1 text-current opacity-70 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                <XIcon className="size-4" />
              </Button>
            ) : null}
            {alert.title === "" ? null : <AlertTitle>{alert.title}</AlertTitle>}
            <AlertDescription className="text-current/90">
              <div
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: safeContent }}
                className="[&_a]:underline"
              />
            </AlertDescription>
          </Alert>
        );

        if (!hasLink) {
          return <div key={alert.id}>{body}</div>;
        }

        return (
          <a
            key={alert.id}
            href={alert.link}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="block no-underline"
          >
            {body}
          </a>
        );
      })}
    </div>
  );
}
