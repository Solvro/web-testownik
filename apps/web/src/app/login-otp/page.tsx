import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginOTPPageClient } from "./client";

export const metadata: Metadata = {
  title: "Logowanie OTP",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginOTPPage() {
  return (
    <Suspense>
      <LoginOTPPageClient />
    </Suspense>
  );
}
