"use client";

import { useEffect, useState } from "react";

// eslint-disable-next-line import/no-default-export
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  // Check for dark mode preference
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const styles = {
    body: {
      margin: 0,
      backgroundColor: prefersDark ? "#0a0a0a" : "#ffffff",
    },
    container: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      backgroundColor: prefersDark ? "#0a0a0a" : "#ffffff",
      color: prefersDark ? "#fafafa" : "#0a0a0a",
    },
    card: {
      maxWidth: "500px",
      padding: "2rem",
      border: `1px solid ${prefersDark ? "#27272a" : "#e5e7eb"}`,
      borderRadius: "0.75rem",
      textAlign: "center" as const,
      backgroundColor: prefersDark ? "#09090b" : "#ffffff",
    },
    iconWrapper: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "2.5rem",
      height: "2.5rem",
      borderRadius: "0.5rem",
      backgroundColor: prefersDark ? "#27272a" : "#f4f4f5",
      margin: "0 auto 1rem",
    },
    title: {
      fontSize: "1.125rem",
      fontWeight: 500,
      margin: "0 0 0.5rem",
      letterSpacing: "-0.025em",
    },
    description: {
      color: prefersDark ? "#a1a1aa" : "#71717a",
      marginBottom: "1.5rem",
      fontSize: "0.875rem",
      lineHeight: 1.625,
    },
    accordionButton: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      width: "100%",
      padding: "0.5rem",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: "0.875rem",
      fontWeight: 500,
      color: prefersDark ? "#fafafa" : "#0a0a0a",
      marginBottom: "0.5rem",
    },
    accordionContent: {
      backgroundColor: prefersDark ? "#27272a" : "#f4f4f5",
      padding: "1rem",
      borderRadius: "0.375rem",
      textAlign: "left" as const,
      fontSize: "0.75rem",
      marginBottom: "1rem",
      display: detailsOpen ? "block" : "none",
    },
    buttonGroup: {
      display: "flex",
      gap: "0.5rem",
      justifyContent: "center",
      marginBottom: "1rem",
    },
    primaryButton: {
      backgroundColor: prefersDark ? "#fafafa" : "#18181b",
      color: prefersDark ? "#18181b" : "#fafafa",
      padding: "0.5rem 1rem",
      borderRadius: "0.375rem",
      border: "none",
      cursor: "pointer",
      fontWeight: 500,
      fontSize: "0.875rem",
    },
    outlineButton: {
      backgroundColor: "transparent",
      color: prefersDark ? "#fafafa" : "#18181b",
      padding: "0.5rem 1rem",
      borderRadius: "0.375rem",
      border: `1px solid ${prefersDark ? "#27272a" : "#e5e7eb"}`,
      cursor: "pointer",
      fontWeight: 500,
      fontSize: "0.875rem",
    },
    footer: {
      fontSize: "0.875rem",
      color: prefersDark ? "#a1a1aa" : "#71717a",
      lineHeight: 1.625,
    },
    link: {
      textDecoration: "underline",
      textUnderlineOffset: "4px",
      color: "inherit",
    },
  };

  return (
    <html lang="pl">
      <body style={styles.body}>
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconWrapper}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 style={styles.title}>Krytyczny błąd aplikacji</h1>
            <p style={styles.description}>
              Wystąpił poważny błąd uniemożliwiający działanie aplikacji.
              Spróbuj odświeżyć stronę.
            </p>
            <button
              onClick={() => {
                setDetailsOpen(!detailsOpen);
              }}
              style={styles.accordionButton}
              type="button"
            >
              Szczegóły błędu
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div style={styles.accordionContent}>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflow: "auto",
                }}
              >
                {error.message}
              </pre>
              {error.digest != null && error.digest !== "" ? (
                <p
                  style={{
                    marginTop: "0.5rem",
                    marginBottom: 0,
                    color: prefersDark ? "#a1a1aa" : "#71717a",
                  }}
                >
                  Digest: {error.digest}
                </p>
              ) : null}
            </div>
            <div style={styles.buttonGroup}>
              <button
                onClick={reset}
                style={styles.primaryButton}
                type="button"
              >
                Spróbuj ponownie
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={styles.outlineButton}
                type="button"
              >
                Strona główna
              </button>
            </div>
            <p style={styles.footer}>
              Jeśli problem się powtarza, możesz utworzyć zgłoszenie na{" "}
              <a
                href="https://github.com/solvro/web-testownik/issues"
                target="_blank"
                rel="noreferrer"
                style={styles.link}
              >
                GitHubie
              </a>
              .
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
