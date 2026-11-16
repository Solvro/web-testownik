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
  resolveImage?: (url: string) => string | null,
  imageRecovery: {
    failed: string;
    retry: string | null;
    generation?: number;
  } = {
    failed: "Nie udało się wczytać obrazu.",
    retry: "Spróbuj ponownie",
  },
) {
  const generation = Number.isSafeInteger(imageRecovery.generation)
    ? imageRecovery.generation!
    : 0;
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
  md.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    const url = String(token.attrGet("src") ?? "");
    // Check the original host before resolving local data, preserving consent.
    if (!imageAllowed(url, allowImages))
      return `<span>[${md.utils.escapeHtml(hiddenImageLabel)}]</span>`;
    const alt = md.renderer.renderInlineAsText(
      token.children ?? [],
      md.options,
      {},
    );
    const retryLabel =
      imageRecovery.retry === null
        ? ""
        : alt
          ? `${imageRecovery.retry}: ${alt}`
          : imageRecovery.retry;
    const retryButton =
      imageRecovery.retry === null
        ? ""
        : `<button class="image-retry" type="button" aria-label="${md.utils.escapeHtml(retryLabel)}">${md.utils.escapeHtml(imageRecovery.retry)}</button>`;
    return `<span class="image-recovery"><img alt="${md.utils.escapeHtml(alt)}" src="${md.utils.escapeHtml(resolveImage?.(url) ?? url)}"/><span class="image-failure" hidden><span role="status">${md.utils.escapeHtml(imageRecovery.failed)}${alt ? ` ${md.utils.escapeHtml(alt)}` : ""}</span> ${retryButton}</span></span>`;
  };
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
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src https: http: data: file:; script-src 'unsafe-inline'"><style>${mathStyle}html,body{margin:0;padding:0;background:transparent;color:${color};font:${size * Math.max(1, fontScale)}px/1.55 -apple-system,BlinkMacSystemFont,Roboto,sans-serif;overflow-wrap:anywhere}p{margin:0 0 8px}ul{padding-inline-start:max(40px,1.5em)}ol{padding-inline-start:max(40px,2.5em)}img{max-width:100%;height:auto}.image-retry{font:inherit;color:inherit;min-height:44px;padding:8px 12px;margin:4px 0;cursor:pointer}pre,.katex-display{overflow-x:auto}a{color:inherit;text-decoration:underline}table{border-collapse:collapse}td,th{border:1px solid #8592a5;padding:6px}</style><script>document.addEventListener("error",function(event){var image=event.target;if(!image||image.tagName!=="IMG")return;var wrapper=image.closest(".image-recovery");if(!wrapper)return;image.hidden=true;wrapper.querySelector(".image-failure").hidden=false;if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage("testownik:image-failed:${generation}")}else{parent.postMessage({testownikImageFailed:${generation}},"*")}},true);document.addEventListener("click",function(event){var button=event.target.closest&&event.target.closest(".image-retry");if(!button||!event.isTrusted)return;event.preventDefault();event.stopPropagation();if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage("testownik:retry-image")}else{parent.postMessage({testownikRetryImage:true},"*")}},true);</script></head><body><main id="content" style="display:flow-root">${md.render(text)}</main><script>function size(){var h=Math.ceil(document.getElementById("content").getBoundingClientRect().height);window.ReactNativeWebView?.postMessage(String(h));parent.postMessage({testownikHeight:h},'*')}new ResizeObserver(size).observe(document.getElementById("content"));size();</script></body></html>`;
}
