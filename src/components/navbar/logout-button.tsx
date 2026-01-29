"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const appContext = useContext(AppContext);
  const router = useRouter();

  const handleLogout = async () => {
    // Call server route to clear  cookies
    await fetch("/auth/logout", { method: "POST" });

    // Clear legacy localStorage data
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("access_token_expires_at");
    localStorage.removeItem("profile_picture");
    localStorage.removeItem("is_staff");
    localStorage.removeItem("user_id");
    localStorage.removeItem("is_guest");

    // Update context
    appContext.setAuthenticated(false);
    appContext.setGuest(false);

    router.push("/");
  };

  return (
    <Button
      variant="destructive"
      size="icon"
      onClick={() => {
        void handleLogout();
      }}
      className="p-2"
      aria-label="Wyloguj się"
    >
      <LogOutIcon />
    </Button>
  );
}
