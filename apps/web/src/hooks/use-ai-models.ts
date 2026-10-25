import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { getUserService } from "@/services";

export const aiModelsQueryKey = ["ai-models"] as const;

export async function invalidateAIModels(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: aiModelsQueryKey });
}

export function useAIModels(enabled = true) {
  return useQuery({
    queryKey: aiModelsQueryKey,
    queryFn: async () => getUserService().getAIModels(),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
