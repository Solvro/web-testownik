import Link from "next/link";

import type { WrappedSeason } from "@/types/wrapped";

/** Shown when the user hasn't generated enough activity for a Wrapped yet. */
export function WrappedEmptyState({
  isGlobal = false,
  season,
}: {
  isGlobal?: boolean;
  season: WrappedSeason | null;
}) {
  const yearLabel = season?.year_label ?? "semestru";

  return (
    <div
      data-screen-label="Pusty stan"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 7,
        background: "#15171c",
        color: "#fff",
        padding: "104px 34px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          animation: "wr-rise .6s .05s both",
          fontFamily: "var(--fm)",
          fontSize: "13px",
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: "#c6ff3a",
          marginBottom: "16px",
        }}
      >
        Wrapped {yearLabel}
      </div>
      <h1
        style={{
          animation: "wr-rise .6s .15s both",
          fontFamily: "var(--fd)",
          fontSize: "clamp(40px,12vw,58px)",
          lineHeight: 0.96,
          letterSpacing: ".01em",
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        Brak
        <br />
        aktywności
      </h1>
      <p
        style={{
          animation: "wr-rise .6s .3s both",
          fontSize: "17px",
          lineHeight: 1.5,
          color: "rgba(255,255,255,.7)",
          margin: "20px auto 0",
          maxWidth: "28ch",
        }}
      >
        {isGlobal
          ? "W tym semestrze nie ma jeszcze aktywności, z której można złożyć globalne Wrapped."
          : "Dla tego semestru nie mamy danych do Twojego Wrapped, więc nie da się go już wygenerować za ten okres. Korzystaj z Testownika w następnym semestrze, a wtedy przygotujemy podsumowanie."}
        {isGlobal ? null : (
          <>
            {" "}
            <b style={{ color: "#fff" }}>
              Bez aktywności w danym semestrze nie mamy z czego go złożyć.
            </b>
          </>
        )}
      </p>
      <div style={{ marginTop: "30px", alignSelf: "center" }}>
        <Link
          href="/quizzes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: "46px",
            padding: "0 22px",
            borderRadius: "12px",
            background: "#c6ff3a",
            color: "#15171c",
            fontFamily: "var(--fm)",
            fontSize: "15px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Przejdź do quizów →
        </Link>
      </div>
    </div>
  );
}
