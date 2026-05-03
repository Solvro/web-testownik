"use client";

import {
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { AppContext } from "@/app-context";
import { env } from "@/env";
import type { Quiz } from "@/types/quiz";

const STORAGE_KEY_PREFIX = "external_images_approved:";

interface StoredApproval {
  domains: string[];
}

interface UseExternalImageApprovalResult {
  isApproved: boolean;
  isInitialized: boolean;
  domains: string[];
  approve: () => void;
  revoke: () => void;
  hasExternalImages: boolean;
}

function getHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

const ALLOWED_DOMAINS = new Set([
  "s3.b.solvro.pl",
  "github.com",
  "githubusercontent.com",
  "raw.githubusercontent.com",
  "cdn.discordapp.com",
  "upload.wikimedia.org",
  "images.unsplash.com",
  "i.imgur.com",
  "lh3.googleusercontent.com",
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isUntrustedImageUrl(url: string): boolean {
  const hostname = getHostname(url);
  if (hostname === null) {
    return false;
  }

  if (ALLOWED_DOMAINS.has(hostname)) {
    return false;
  }

  try {
    const apiUrl = env.NEXT_PUBLIC_API_URL;
    const apiHost = getHostname(apiUrl);
    if (hostname === apiHost) {
      return false;
    }
  } catch {
    return true;
  }

  return true;
}

function extractExternalDomains(quiz: Quiz): string[] {
  const domains = new Set<string>();

  for (const question of quiz.questions) {
    if (question.image != null && isUntrustedImageUrl(question.image)) {
      const host = getHostname(question.image);
      if (host !== null) {
        domains.add(host);
      }
    }
    for (const answer of question.answers) {
      if (answer.image != null && isUntrustedImageUrl(answer.image)) {
        const host = getHostname(answer.image);
        if (host !== null) {
          domains.add(host);
        }
      }
    }
  }

  return [...domains].toSorted();
}

export function useExternalImageApproval(
  quiz: Quiz,
): UseExternalImageApprovalResult {
  const appContext = useContext(AppContext);

  const isMaintainer = quiz.maintainer?.id === appContext.user?.user_id;
  const hasExternalImages = quiz.has_external_images ?? false;

  const domains = useMemo(
    () => (hasExternalImages ? extractExternalDomains(quiz) : []),
    [hasExternalImages, quiz],
  );

  const shouldAutoApprove =
    isMaintainer || !hasExternalImages || domains.length === 0;

  const storageKey = `${STORAGE_KEY_PREFIX}${quiz.id}`;

  const readStoredApproval = useCallback((): boolean => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) {
        return false;
      }

      const parsed = JSON.parse(stored) as StoredApproval;

      if (parsed.domains.length !== domains.length) {
        return false;
      }

      const storedSet = new Set(parsed.domains);
      return domains.every((d) => storedSet.has(d));
    } catch {
      return false;
    }
  }, [storageKey, domains]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") {
        return () => {
          /* empty */
        };
      }

      const handler = (event: StorageEvent) => {
        // Only react to changes for this quiz key (or clear)
        if (event.key === storageKey || event.key === null) {
          onStoreChange();
        }
      };

      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("storage", handler);
      };
    },
    [storageKey],
  );

  const storedApproved = useSyncExternalStore(
    subscribe,
    readStoredApproval,
    () => false,
  );

  const [manualApproved, setManualApproved] = useState(false);
  const isApproved = shouldAutoApprove || manualApproved || storedApproved;

  const approve = useCallback(() => {
    if (typeof window !== "undefined") {
      const data: StoredApproval = { domains };
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
    setManualApproved(true);
  }, [domains, storageKey]);

  const revoke = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setManualApproved(false);
  }, [storageKey]);

  return {
    isApproved,
    isInitialized: true,
    domains,
    approve,
    revoke,
    hasExternalImages,
  };
}

export { isUntrustedImageUrl };
