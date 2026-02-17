"use client";

import { useContext, useEffect, useState } from "react";

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

  const domains = hasExternalImages ? extractExternalDomains(quiz) : [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getStoredApproval = (): boolean => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${quiz.id}`);
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
  };

  const [isApproved, setIsApproved] = useState<boolean>(() => {
    if (isMaintainer || !hasExternalImages || domains.length === 0) {
      return true;
    }
    return getStoredApproval();
  });

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (isMaintainer || !hasExternalImages || domains.length === 0) {
      setIsApproved(true);
      setIsInitialized(true);
      return;
    }

    const approved = getStoredApproval();
    setIsApproved(approved);
    setIsInitialized(true);
  }, [domains.length, getStoredApproval, hasExternalImages, isMaintainer]);

  const approve = () => {
    if (typeof window !== "undefined") {
      const data: StoredApproval = { domains };
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${quiz.id}`,
        JSON.stringify(data),
      );
    }
    setIsApproved(true);
  };

  const revoke = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${quiz.id}`);
    }
    setIsApproved(false);
  };

  return {
    isApproved,
    isInitialized,
    domains,
    approve,
    revoke,
    hasExternalImages,
  };
}

export { isUntrustedImageUrl };
