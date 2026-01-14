"use client";

import { Suspense } from "react";

import { ConnectGuestAccount } from "@/components/connect-guest-account";

export function ConnectAccountPageClient() {
  return (
    <Suspense>
      <ConnectGuestAccount />
    </Suspense>
  );
}
