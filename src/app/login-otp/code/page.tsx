import type { Metadata } from "next";

import { LoginOTPCodeClient } from "./client";

export const metadata: Metadata = {
  title: "Wprowadź kod",
};

export default async function LoginOTPCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;

  if (email === undefined || email.trim() === "") {
    const { redirect } = await import("next/navigation");
    redirect("/login-otp");
    return;
  }

  return <LoginOTPCodeClient email={email} error={error} />;
}
