import PropagateLoader from "react-spinners/PropagateLoader";
import { LoaderSizeProps } from "react-spinners/helpers/props";
import { useTheme } from "@/components/theme-provider.tsx";

const Loader = (props: LoaderSizeProps) => {
  let { theme } = useTheme();

  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  const color = theme === "dark" ? "#ffffff" : "#000000";

  return <PropagateLoader color={color} {...props} />;
};

export default Loader;
