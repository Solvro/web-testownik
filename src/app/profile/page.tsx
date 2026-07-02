import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfilePageClient } from "./client";

export const metadata: Metadata = {
  title: "Profil",
};

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageClient />
    </Suspense>
  );
}
