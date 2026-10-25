import type { Metadata } from "next";

import { LoginPageClient } from "./client";

export const metadata: Metadata = {
  title: "Zaloguj się",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
