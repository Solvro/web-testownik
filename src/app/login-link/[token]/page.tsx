import type { Metadata } from "next";

import { LoginLinkPageClient } from "./client";

export const metadata: Metadata = {
  title: "Logowanie",
};

export default async function LoginLinkPage({
  params,
}: PageProps<"/login-link/[token]">) {
  const { token } = await params;
  return <LoginLinkPageClient token={token} />;
}
