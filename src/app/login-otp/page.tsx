import type { Metadata } from "next";

import { LoginOTPPageClient } from "./client";

export const metadata: Metadata = {
  title: "Logowanie OTP",
};

export default function LoginOTPPage() {
  return <LoginOTPPageClient />;
}
