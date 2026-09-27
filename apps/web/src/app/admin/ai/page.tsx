import type { Metadata } from "next";

import { AIAdminClient } from "./client";

export const metadata: Metadata = { title: "Administracja AI" };

export default function AIAdminPage() {
  return <AIAdminClient />;
}
