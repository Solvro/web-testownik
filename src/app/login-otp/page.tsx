import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginOTPPageClient } from "./client";

export const metadata: Metadata = {
  title: "Logowanie OTP",
};

export default function LoginOTPPage() {
  return (
    <Suspense>
      <LoginOTPPageClient />
    </Suspense>
  );
}
