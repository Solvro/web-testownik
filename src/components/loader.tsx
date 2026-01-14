import { useTheme } from "next-themes";
import PropagateLoader from "react-spinners/PropagateLoader";
import type { LoaderSizeProps } from "react-spinners/helpers/props";

export function Loader(props: LoaderSizeProps) {
  const { resolvedTheme } = useTheme();

  const color = resolvedTheme === "dark" ? "#ffffff" : "#000000";

  return <PropagateLoader color={color} {...props} />;
}
