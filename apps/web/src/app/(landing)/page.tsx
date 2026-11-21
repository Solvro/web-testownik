import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getLatestBlogPostsSSR } from "@/app/(landing)/lib/blog";
import { getContributorsSSR } from "@/app/(landing)/lib/contributors";
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
  searchParams: Promise<LandingSearchParameters & { error?: string }>;
}) {
  const parameters = await searchParams;
  // The layout's ErrorHandler shows the banned screen, which the landing's
  // hero would otherwise cover.
  if (parameters.error === "user_banned") {
    return null;
  }

  const user = await getServerCurrentUser();

  if (user != null && !isLandingRequest(parameters)) {
    redirect("/quizzes");
  }

  const captureRequest = parseCaptureRequest(parameters);
  if (captureRequest !== null) {
    return <DeviceCapture request={captureRequest} />;
  }

  // The contributor rail and the update note's posts stream in so their
  // requests cannot delay the hero.
  return (
    <LandingPage
      blogPosts={getLatestBlogPostsSSR()}
      contributors={getContributorsSSR()}
      isAuthenticated={user != null}
    />
  );
}
