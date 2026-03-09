import { useEffect, useRef } from "react";

import type { JWTPayload } from "@/lib/auth/types";
import { migrateLegacyGuestQuizzes } from "@/lib/legacy-guest-quiz-migration";
import { getQueryClient } from "@/lib/query-client";
import { getServices } from "@/services";
import { ACCOUNT_TYPE } from "@/types/user";

export function useGuestQuizMigration(user: JWTPayload | null) {
  const migrationUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (user === null) {
      migrationUserIdRef.current = null;
      return;
    }

    if (user.account_type !== ACCOUNT_TYPE.GUEST) {
      return;
    }

    if (migrationUserIdRef.current === user.user_id) {
      return;
    }

    migrationUserIdRef.current = user.user_id;

    void (async () => {
      const result = await migrateLegacyGuestQuizzes(getServices().quiz);

      if (result.migratedCount === 0) {
        return;
      }

      const queryClient = getQueryClient();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["user-quizzes"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["last-used-quizzes"],
        }),
      ]);
    })();
  }, [user]);
}
