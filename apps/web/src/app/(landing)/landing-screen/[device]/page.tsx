import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { ScreenFrameDocument } from "@/app/(landing)/components/scene/screen-frame-document";
import { parseScreenFrameRequest } from "@/app/(landing)/components/scene/screen-frame-protocol";

/** An iframe of `scene/device-screen-frame.tsx`, served in the bare document shell. */
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
      <h1 className="sr-only">Podgląd Testownika: {device}</h1>
      <ScreenFrameDocument request={request} />
    </main>
  );
}
