import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";

import { Alerts } from "@/components/alerts";
import { AppFooter } from "@/components/app-footer";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Testownik Solvro",
    template: "%s - Testownik Solvro",
  },
  description:
    "Przygotuj się do sesji z Testownikiem Solvro! Twórz quizy, testuj się i dziel zestawy z innymi. Nauka do egzaminów nigdy nie była łatwiejsza!",
  creator: "KN Solvro",
  alternates: {
    canonical: "https://testownik.solvro.pl",
  },
  robots: "index, follow",
  ...(process.env.COOLIFY_URL != null &&
    process.env.COOLIFY_URL !== "" && {
      metadataBase: new URL(process.env.COOLIFY_URL),
    }),
  openGraph: {
    title: "Testownik Solvro - Twoje narzędzie do nauki",
    description:
      "Przygotuj się do sesji z Testownikiem! Twórz quizy, testuj się i dziel się quizami z innymi. Nauka jeszcze nigdy nie była tak prosta.",
    type: "website",
    images: "/favicon/180x180.png",
    locale: "pl_PL",
  },
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "application/ld+json": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Testownik Solvro",
      url: "https://testownik.solvro.pl",
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Testownik Solvro",
              url: "https://testownik.solvro.pl",
            }),
          }}
        />
      </head>
      <body>
        <Providers>
          <div
            className="mx-auto flex w-full max-w-screen-xl flex-col gap-4 px-4 pb-24"
            id="container"
          >
            <Navbar />
            <Suspense>
              <Alerts />
            </Suspense>
            {children}
          </div>
          <Toaster richColors />
          <AppFooter />
        </Providers>
        <Script
          src="https://analytics.solvro.pl/script.js"
          data-website-id="fd87b2a1-12b0-4ca2-9e6f-a85f58d981cc"
          data-domains="testownik.solvro.pl"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
