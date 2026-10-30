import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getContributorsSSR } from "@/app/(landing)/lib/contributors";
import { getPerks } from "@/app/(landing)/lib/perks.server";
import { getServerCurrentUser } from "@/lib/auth/utils.server";

import {
  isLandingRequest,
  parseCaptureRequest,
} from "./components/capture/capture-request";
import type { LandingSearchParameters } from "./components/capture/capture-request";
import { DeviceCapture } from "./components/capture/device-capture-loader";
import { LandingPage } from "./components/landing-page";

export const metadata: Metadata = {
  title: {
    absolute: "Testownik - uczysz się wszędzie",
  },
  description:
    "Quizy, oceny, statystyki, AI i wspólna biblioteka. Cała sesja w jednym Testowniku.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Testownik - uczysz się wszędzie",
    description:
      "Quizy, oceny, statystyki, AI i wspólna biblioteka. Cała sesja w jednym Testowniku.",
    url: "/",
    type: "website",
    locale: "pl_PL",
    siteName: "Testownik Solvro",
    images: [{ url: "/opengraph-image.png", alt: "Testownik Solvro" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image.png"],
    title: "Testownik - uczysz się wszędzie",
    description:
      "Quizy, oceny, statystyki, AI i wspólna biblioteka. Cała sesja w jednym Testowniku.",
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<LandingSearchParameters>;
}) {
  const user = await getServerCurrentUser();
  const parameters = await searchParams;

  if (user != null && !isLandingRequest(parameters)) {
    redirect("/quizzes");
  }

  const captureRequest = parseCaptureRequest(parameters);
  if (captureRequest !== null) {
    return <DeviceCapture request={captureRequest} />;
  }

  // Deliberately not awaited: the contributor rail and the partner numbers
  // stream into their sections, so outside calls cannot delay the hero.
  return (
    <LandingPage
      contributors={getContributorsSSR()}
      perks={getPerks()}
      isAuthenticated={user != null}
    />
  );
}
