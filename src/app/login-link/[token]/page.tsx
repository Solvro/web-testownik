/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";

import { LoginLinkPageClient } from "./client";

export const metadata: Metadata = {
  title: "Logowanie",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function LoginLinkPage({ params }: PageProps) {
  const { token } = await params;
  return <LoginLinkPageClient token={token} />;
}
