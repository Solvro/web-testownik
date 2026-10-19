import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { ScreenFrameDocument } from "@/app/(dashboard)/components/landing/scene/screen-frame-document";
import { parseScreenFrameRequest } from "@/app/(dashboard)/components/landing/scene/screen-frame-protocol";

/**
 * One live screen of the landing page's desktop device stack, rendered in an
 * iframe by `scene/device-screen-frame.tsx`. The root layout serves it in its
 * bare shell (see `lib/document-shell.ts`); it is not a page of its own.
 */
export const metadata: Metadata = {
  title: "Podgląd ekranu",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function LandingScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ device: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ device }, search] = await Promise.all([params, searchParams]);
  const request = parseScreenFrameRequest(device, search);
  if (request === null) {
    notFound();
  }
  return (
    <main>
      <h1 className="sr-only">Podgląd Testownika — {device}</h1>
      <ScreenFrameDocument request={request} />
    </main>
  );
}
