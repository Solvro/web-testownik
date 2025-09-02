import { ToastContainer as ReactToastContainer } from "react-toastify";

import { useTheme } from "@/components/theme-provider.tsx";

export function ToastContainer() {
  let { theme } = useTheme();

  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return (
    <ReactToastContainer
      theme={theme === "dark" ? "dark" : "light"}
      newestOnTop={false}
      pauseOnFocusLoss
      position="bottom-right"
      draggable={true}
    />
  );
}
