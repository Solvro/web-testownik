import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";

import { Alerts } from "@/components/alerts";
import { AppFooter } from "@/components/app-footer";
import { Navbar } from "@/components/navbar";
import { ToastContainer } from "@/components/toast-container";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Testownik Solvro",
    template: "%s - Testownik Solvro",
  },
  description:
    "Przygotuj się do sesji z Testownikiem Solvro! Twórz quizy, testuj się i dziel zestawy z innymi. Nauka do egzaminów nigdy nie była łatwiejsza!",
  keywords:
    "Testownik, Solvro, KN Solvro, nauka do egzaminu, quizy, aplikacja edukacyjna, interaktywna nauka, przygotowanie do sesji, politechnika, studia, uczelnia, testy online, aplikacja mobilna, nauka online, edukacja, pwr, testownik, testownik solvro, testownik pwr, testownik politechnika, testownik studia, testownik uczelnia, testownik aplikacja, testownik edukacja, testownik nauka, testownik quizy, testownik przygotowanie do sesji",
  authors: [{ name: "KN Solvro" }],
  robots: "index, follow",
  openGraph: {
    title: "Testownik Solvro - Twoje narzędzie do nauki",
    description:
      "Przygotuj się do sesji z Testownikiem! Twórz quizy, testuj się i dziel się quizami z innymi. Nauka jeszcze nigdy nie była tak prosta.",
    type: "website",
    url: "https://testownik.solvro.pl",
    images: "https://testownik.solvro.pl/favicon/180x180.png",
    locale: "pl_PL",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon/16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon/192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
            <Suspense>
              <Navbar />
            </Suspense>
            <Suspense>
              <Alerts />
            </Suspense>
            {children}
          </div>
          <ToastContainer />
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
