"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import { leaveSafely } from "@/components/quiz/editor/leave-safely";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  onLogout?: () => void;
}

export function LogoutButton({ onLogout }: LogoutButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    onLogout?.();

    // Call server route to clear cookies
    await fetch("/auth/logout", { method: "POST" });

    // Clear legacy localStorage data
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("access_token_expires_at");
    localStorage.removeItem("profile_picture");
    localStorage.removeItem("is_staff");
    localStorage.removeItem("user_id");
    localStorage.removeItem("is_guest");

    router.push("/");
    router.refresh();
    queryClient.clear();
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        // Logging out leaves the page, so an open quiz editor asks first.
        leaveSafely(() => {
          void handleLogout();
        });
      }}
      className="p-2"
      aria-label="Wyloguj się"
    >
      <DoorOpen />
    </Button>
  );
}
