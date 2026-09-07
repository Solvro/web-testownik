import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getUserService } from "@/services";
import type { UserData } from "@/types/user";

export const userProfileQueryKey = ["user-profile"] as const;

export function useUpdateProfilePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File | null) =>
      file === null
        ? getUserService().deleteProfilePhoto()
        : getUserService().uploadProfilePhoto(file),
    onSuccess: (updatedUserData) => {
      queryClient.setQueryData<UserData>(userProfileQueryKey, updatedUserData);
    },
  });
}

export function useUserProfile({
  placeholderData,
}: { placeholderData?: UserData } = {}) {
  return useQuery({
    queryKey: userProfileQueryKey,
    queryFn: async () => getUserService().getUserData(),
    placeholderData,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: Partial<UserData>) =>
      getUserService().updateUserProfile(userData),
    onSuccess: (updatedUserData) => {
      queryClient.setQueryData<UserData>(userProfileQueryKey, updatedUserData);
    },
  });
}
