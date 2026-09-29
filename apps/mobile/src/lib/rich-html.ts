import katex from "katex";
import MarkdownIt from "markdown-it";

import mathStyle from "./math-style.json";
import { imageAllowed, type ImageApproval } from "./image-policy";

export function richHtml(
  text: string,
  color: string,
  allowImages: ImageApproval = false,
  fontScale = 1,
  size = 17,
  hiddenImageLabel = "Obraz zewnętrzny ukryty",
) {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
  md.renderer.rules.image = (tokens, index) =>
    imageAllowed(String(tokens[index].attrGet("src") ?? ""), allowImages)
      ? `<img alt="" src="${md.utils.escapeHtml(String(tokens[index].attrGet("src") ?? ""))}"/>`
      : `<span>[${md.utils.escapeHtml(hiddenImageLabel)}]</span>`;
  md.inline.ruler.before("escape", "math", (state, silent) => {
    const start = state.pos;
    const pair = state.src.slice(start, start + 2);
    const slash = pair === "\\(" || pair === "\\[";
    if (state.src[start] !== "$" && !slash) return false;
    const display = pair === "$$" || pair === "\\[";
    const marker = slash ? pair : display ? "$$" : "$";
    const close = slash ? (display ? "\\]" : "\\)") : marker;
    const end = state.src.indexOf(close, start + marker.length);
    if (end < 0) return false;
    if (!silent) {
      const token = state.push("math", "", 0);
      token.content = state.src.slice(start + marker.length, end);
      token.meta = { display };
    }
    state.pos = end + close.length;
    return true;
  });
  md.renderer.rules.math = (tokens, index) =>
    katex.renderToString(tokens[index].content, {
      displayMode: Boolean(tokens[index].meta?.display),
      throwOnError: false,
      trust: false,
      strict: "ignore",
    });
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src https: http: data: file:; script-src 'unsafe-inline'"><style>${mathStyle}html,body{margin:0;padding:0;background:transparent;color:${color};font:${size * Math.max(1, fontScale)}px/1.55 -apple-system,BlinkMacSystemFont,Roboto,sans-serif;overflow-wrap:anywhere}p{margin:0 0 8px}img{max-width:100%;height:auto}pre,.katex-display{overflow-x:auto}a{color:inherit;text-decoration:underline}table{border-collapse:collapse}td,th{border:1px solid #8592a5;padding:6px}</style></head><body><main id="content" style="display:flow-root">${md.render(text)}</main><script>function size(){var h=Math.ceil(document.getElementById("content").getBoundingClientRect().height);window.ReactNativeWebView?.postMessage(String(h));parent.postMessage({testownikHeight:h},'*')}new ResizeObserver(size).observe(document.getElementById("content"));size();</script></body></html>`;
}
