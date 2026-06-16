import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { getFolderService } from "@/services";
import type { Folder, Library } from "@/types/quiz";

export function useUserLibrary(
  props?: Omit<UseQueryOptions<Library>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["user-library"],
    queryFn: async () => getFolderService().getLibrary(),
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}

export function useUserFolders(
  props?: Omit<UseQueryOptions<Folder[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["user-folders"],
    queryFn: async () => getFolderService().getFolders(),
    refetchOnWindowFocus: false,
    retry: 1,
    ...props,
  });
}
