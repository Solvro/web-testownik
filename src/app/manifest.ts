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
        src: "favicon/16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "favicon/32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "favicon/48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "favicon/180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "favicon/192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "solvro_mono.svg",
        type: "image/svg+xml",
        sizes: "529x415",
      },
    ],
  };
}
