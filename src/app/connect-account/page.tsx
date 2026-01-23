import type { Metadata } from "next";

import { ConnectAccountPageClient } from "./client";

export const metadata: Metadata = {
  title: "Połącz konto",
};

export default function ConnectAccountPage() {
  return <ConnectAccountPageClient />;
}
