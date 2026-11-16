import { Image } from "expo-image";

import { useTheme } from "../lib/theme";

/** The same official mark used by the web app. Its row supplies the label. */
export default function SolvroLogo({ color }: { color?: string }) {
  const c = useTheme();
  return (
    <Image
      source={require("../../assets/solvro.svg")}
      contentFit="contain"
      tintColor={color ?? c.text}
      accessible={false}
      style={{ width: 29, height: 29 }}
    />
  );
}
