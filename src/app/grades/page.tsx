/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";

import { GradesPageClient } from "./client";

export const metadata: Metadata = {
  title: "Oceny",
};

export default function GradesPage() {
  return <GradesPageClient />;
}
