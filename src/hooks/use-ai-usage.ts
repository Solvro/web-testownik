import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { getUserService } from "@/services";

export const aiUsageQueryKey = ["ai-usage"] as const;

export async function invalidateAIUsage(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: aiUsageQueryKey });
}

export function useAIUsage(enabled = true) {
  return useQuery({
    queryKey: aiUsageQueryKey,
    queryFn: async () => getUserService().getAIUsage(30),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
