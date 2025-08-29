import { ToastContainer as ReactToastContainer } from "react-toastify";
import React from "react";
import { useTheme } from "@/components/theme-provider.tsx";

const ToastContainer: React.FC = () => {
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
};

export default ToastContainer;
