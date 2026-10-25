import type { MetadataRoute } from "next";

// eslint-disable-next-line import/no-default-export
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Testownik Solvro",
    short_name: "Testownik",
    description:
      "Przygotuj się do sesji z Testownikiem Solvro! Twórz quizy, testuj się i dziel zestawy z innymi.",
    start_url: "/",
    display: "standalone",
    theme_color: "#1A2856",
    background_color: "#0b111c",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
