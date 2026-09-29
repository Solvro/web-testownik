import { containsAiMath } from "../lib/ai-math";
import RichText from "./RichText";

/** Keep token updates native; typeset completed formulas with the bundled offline renderer. */
export default function AiRichText({
  text,
  streaming = false,
  size = 17,
}: {
  text: string;
  streaming?: boolean;
  size?: number;
}) {
  return (
    <RichText
      text={text}
      size={size}
      nativeMarkdown={streaming || !containsAiMath(text)}
    />
  );
}
