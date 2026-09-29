/** Render completed formulas only; code examples remain literal Markdown. */
export function containsAiMath(text: string): boolean {
  const prose = text
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "")
    .replace(/\\\$/g, "");
  return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(
    prose,
  );
}
