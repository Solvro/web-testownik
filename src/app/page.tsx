/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";

import { DashboardPageClient } from "./client";

export const metadata: Metadata = {
  title: "Testownik Solvro",
};

export default function HomePage() {
  return <DashboardPageClient />;
}
