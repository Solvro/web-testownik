import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerCurrentUser } from "@/lib/auth/utils.server";
import { getContributorsSSR } from "@/lib/dashboard-ssr";

import {
  isLandingRequest,
  parseCaptureRequest,
} from "./components/landing/capture/capture-request";
import type { LandingSearchParameters } from "./components/landing/capture/capture-request";
import { DeviceCapture } from "./components/landing/capture/device-capture";
import { LandingPage } from "./components/landing/landing-page";

export const metadata: Metadata = {
  title: {
    absolute: "Testownik — uczysz się wszędzie",
  },
  description:
    "Quizy, oceny, statystyki, AI i wspólna biblioteka. Cała sesja w jednym Testowniku.",
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

  // Deliberately not awaited: the contributor rail streams into the team
  // section, so three GitHub calls cannot delay the hero.
  return <LandingPage contributors={getContributorsSSR()} />;
}
