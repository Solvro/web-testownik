"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface GuestStart {
  isStarting: boolean;
  start: () => void;
}

/**
 * Creates a guest account and moves the visitor into the app. Every "start"
 * button on the page shares one instance so they disable together.
 */
export function useGuestStart(): GuestStart {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const start = (): void => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);

    void (async () => {
      try {
        const response = await fetch("/auth/guest/create", { method: "POST" });
        if (!response.ok) {
          throw new Error(
            `Guest creation failed with ${response.status.toString()}`,
          );
        }
      } catch (error) {
        console.error("Error creating guest account:", error);
        setIsStarting(false);
        toast.error("Nie udało się uruchomić trybu gościa. Spróbuj ponownie.");
        return;
      }

      router.push("/quizzes");
      router.refresh();
    })();
  };

  return { isStarting, start };
}
