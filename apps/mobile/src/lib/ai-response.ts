import { parseAiHints } from "./ai-hints";
import { consumeText } from "./stream";

/** Completion is published only after the full response passes its format checks. */
export async function consumeAiResponse(
  request: Promise<Response>,
  options: {
    mode: "hint" | "explain";
    answerCount: number;
    signal: AbortSignal;
    onText: (text: string) => void;
    onReady: () => void;
    emptyMessage: string;
  },
) {
  const response = await request;
  let result = "";
  await consumeText(
    response,
    (value) => {
      result = value;
      options.onText(value);
    },
    false,
    options.signal,
  );
  if (
    !result.trim() ||
    (options.mode === "hint" &&
      !parseAiHints(result, options.answerCount).length)
  )
    throw new Error(options.emptyMessage);
  if (!options.signal.aborted) options.onReady();
}
