import type { Metadata } from "next";

import { LoginOTPCodeClient } from "./client";

export const metadata: Metadata = {
  title: "Wprowadź kod",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginOTPCodePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return <LoginOTPCodeClient error={error} />;
}
