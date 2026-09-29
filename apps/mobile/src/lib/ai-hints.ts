/** Existing web /ai/hint contract; accepts unfinished streamed blocks. */
export function parseAiHints(text: string, answerCount: number) {
  const blocks: { key: string; answerIndex?: number; text: string }[] = [];
  const clean = (value: string) => value.replace(/<[^>]*>?$/g, "").trim();
  const general = /<general_hint>([\s\S]*?)(?:<\/general_hint>|$)/.exec(text);
  if (general && clean(general[1]))
    blocks.push({ key: "general", text: clean(general[1]) });
  const answers = /<hint\s+answer=["'](\d+)["']>([\s\S]*?)(?:<\/hint>|$)/g;
  for (const match of text.matchAll(answers)) {
    const answerIndex = Number(match[1]) - 1;
    const content = clean(match[2]);
    if (
      content &&
      answerIndex >= 0 &&
      answerIndex < answerCount &&
      !blocks.some((b) => b.answerIndex === answerIndex)
    ) {
      blocks.push({ key: `answer-${answerIndex}`, answerIndex, text: content });
    }
  }
  if (!blocks.length && !text.trimStart().startsWith("<") && text.trim()) {
    blocks.push({ key: "plain", text: text.trim() });
  }
  return blocks;
}
