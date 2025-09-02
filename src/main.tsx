import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppContextProvider } from "./app-context.tsx";
import { App } from "./app.tsx";
import "./styles/index.css";

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
