import type { Metadata } from "next";

import { ProfilePageClient } from "./client";

export const metadata: Metadata = {
  title: "Profil",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
