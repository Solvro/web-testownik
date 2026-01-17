import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppContextProvider } from "@/app-context-provider";
import { runMigrations } from "@/lib/migration";

import { App } from "./app.tsx";
import "./styles/index.css";

// Migration to new data format, could be removed after a grace period
// Migration was introduced 17.01.2026, could be removed after 17.02.2026
runMigrations();

const root = document.querySelector("#root");
if (root == null) {
  throw new Error("Failed to find the root element");
}

createRoot(root).render(
  <StrictMode>
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </StrictMode>,
);
