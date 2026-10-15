"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RefObject } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getLeaveHandler, setLeaveHandler } from "./leave-safely";

type Pending =
  | { type: "link"; href: string }
  | { type: "traverse"; key: string }
  | { type: "action"; run: () => void };

/** Missing in browsers without the Navigation API, despite its type. */
function navigationApi() {
  return window.navigation as Navigation | undefined;
}

/** The same-origin page an unmodified click on `event` would open. */
function linkTarget(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return null;
  }
  const anchor = event.target.closest("a[href]");
  if (
    !(anchor instanceof HTMLAnchorElement) ||
    (anchor.target !== "" && anchor.target !== "_self") ||
    anchor.hasAttribute("download")
  ) {
    return null;
  }
  const url = new URL(anchor.href, window.location.href);
  const here = new URL(window.location.href);
  if (
    url.origin !== here.origin ||
    (url.pathname === here.pathname && url.search === here.search)
  ) {
    return null;
  }
  return url.pathname + url.search + url.hash;
}

/**
 * Asks before leaving with unsaved changes: closing or reloading the tab, app
 * links, and, where the Navigation API exists, Back and Forward.
 */
export function UnsavedChangesGuard({
  when,
  allowRef,
}: {
  /** Keep this true until the changes are saved, including while saving. */
  when: boolean;
  /**
   * Set to true to let the next navigation through, such as returning after
   * a successful save, before `when` has caught up.
   */
  allowRef: RefObject<boolean>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    if (!when) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowRef.current) {
        event.preventDefault();
      }
    };
    // Capture on window runs before the router's link handler.
    const click = (event: MouseEvent) => {
      const href = linkTarget(event);
      if (href === null || allowRef.current) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setPending({ type: "link", href });
    };
    const navigate = (event: NavigateEvent) => {
      const key = event.destination.key;
      if (
        allowRef.current ||
        key === null ||
        event.navigationType !== "traverse" ||
        !event.cancelable ||
        event.hashChange
      ) {
        return;
      }
      event.preventDefault();
      setPending({ type: "traverse", key });
    };
    const ask = (run: () => void) => {
      if (allowRef.current) {
        run();
      } else {
        setPending({ type: "action", run });
      }
    };
    setLeaveHandler(ask);
    window.addEventListener("beforeunload", warn);
    window.addEventListener("click", click, true);
    navigationApi()?.addEventListener("navigate", navigate);
    return () => {
      if (getLeaveHandler() === ask) {
        setLeaveHandler(null);
      }
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("click", click, true);
      navigationApi()?.removeEventListener("navigate", navigate);
    };
  }, [when, allowRef]);

  function leave(target: Pending) {
    allowRef.current = true;
    setPending(null);
    if (target.type === "link") {
      router.push(target.href);
    } else if (target.type === "action") {
      target.run();
    } else {
      void navigationApi()
        ?.traverseTo(target.key)
        .finished.catch(() => {
          allowRef.current = false;
        });
    }
  }

  // A save which was running when the dialog opened has since succeeded.
  const nothingToLose = !when;

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPending(null);
        }
      }}
    >
      <AlertDialogContent>
        {nothingToLose ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Zmiany zostały zapisane</AlertDialogTitle>
              <AlertDialogDescription>
                Zapis zakończył się, więc możesz bezpiecznie przejść dalej.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zostań</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pending !== null) {
                    leave(pending);
                  }
                }}
              >
                Przejdź dalej
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Masz niezapisane zmiany</AlertDialogTitle>
              <AlertDialogDescription>
                Jeśli wyjdziesz bez zapisywania, zmiany w tym quizie zostaną
                utracone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zostań</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (pending !== null) {
                    leave(pending);
                  }
                }}
              >
                Odrzuć zmiany
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
