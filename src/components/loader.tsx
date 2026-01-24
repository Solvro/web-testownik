import PropagateLoader from "react-spinners/PropagateLoader";
import type { LoaderSizeProps } from "react-spinners/helpers/props";

export function Loader(props: LoaderSizeProps) {
  return <PropagateLoader color="var(--foreground)" {...props} />;
}
