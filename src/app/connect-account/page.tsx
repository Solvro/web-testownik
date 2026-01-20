import type { Metadata } from "next";
import { Suspense } from "react";

import { ConnectAccountPageClient } from "./client";

export const metadata: Metadata = {
  title: "Połącz konto",
};

export default function ConnectAccountPage() {
  return (
    <Suspense
      fallback={<div className="flex justify-center p-8">Ładowanie...</div>}
    >
      <ConnectAccountPageClient />
    </Suspense>
  );
}
