"use client";

import { useTheme } from "next-themes";
import { ToastContainer as ReactToastContainer } from "react-toastify";

export function ToastContainer() {
  const { resolvedTheme } = useTheme();

  return (
    <ReactToastContainer
      theme={
        resolvedTheme === "dark" || resolvedTheme === "light"
          ? resolvedTheme
          : "light"
      }
      newestOnTop={false}
      pauseOnFocusLoss
      position="bottom-right"
      draggable={true}
    />
  );
}
