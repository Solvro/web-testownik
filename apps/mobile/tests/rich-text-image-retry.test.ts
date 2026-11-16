import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
// Expo's lint resolver maps both paths to web; Vitest exercises each actual file.
// eslint-disable-next-line import/no-duplicates
import RichText from "../src/components/RichText";
// eslint-disable-next-line import/no-duplicates
import WebRichText from "../src/components/RichText.web";

const hooks = vi.hoisted(() => ({
  cursor: 0,
  memoCursor: 0,
  refCursor: 0,
  effectCursor: 0,
  refs: [] as { current: unknown }[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  pendingEffects: [] as (() => void)[],
  web: false,
  color: "#000000",
  fontScale: 1,
  states: [] as unknown[],
  memos: [] as { value: unknown; deps: unknown[] }[],
  offline: false,
  downloaded: false,
  frameWindow: {},
  effect: undefined as undefined | (() => unknown),
  message: undefined as undefined | ((event: unknown) => void),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] =
          typeof next === "function" ? next(hooks.states[index]) : next;
      },
    ];
  },
  useMemo: (compute: () => unknown, deps: unknown[]) => {
    const index = hooks.memoCursor++;
    const previous = hooks.memos[index];
    if (
      !previous ||
      previous.deps.some((value, i) => !Object.is(value, deps[i]))
    )
      hooks.memos[index] = { value: compute(), deps };
    return hooks.memos[index].value;
  },
  useRef: (initial: unknown) => {
    const index = hooks.refCursor++;
    if (!(index in hooks.refs))
      hooks.refs[index] = {
        current: hooks.web ? { contentWindow: hooks.frameWindow } : initial,
      };
    return hooks.refs[index];
  },
  useLayoutEffect: (
    effect: () => undefined | (() => void),
    deps: unknown[],
  ) => {
    const index = hooks.effectCursor++;
    const previous = hooks.effects[index];
    if (
      !previous ||
      previous.deps.some((value, i) => !Object.is(value, deps[i]))
    ) {
      previous?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() };
    }
  },
  useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
    hooks.effect = effect;
    const index = hooks.effectCursor++;
    const previous = hooks.effects[index];
    if (
      !previous ||
      previous.deps.some((value, i) => !Object.is(value, deps[i]))
    ) {
      hooks.pendingEffects.push(() => {
        previous?.cleanup?.();
        hooks.effects[index] = { deps, cleanup: effect() };
      });
    }
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  useWindowDimensions: () => ({ fontScale: hooks.fontScale }),
}));
vi.mock("../src/components/ui", () => ({ Button: "Button" }));
vi.mock("react-native-webview", () => ({ default: "WebView" }));
vi.mock("react-native-markdown-display", () => ({ default: "Markdown" }));
vi.mock("../src/lib/locale", () => ({
  useLocale: () => ({ t: (_pl: string, en: string) => en }),
}));
vi.mock("../src/lib/theme", () => ({
  useTheme: () => ({ text: hooks.color, muted: "#777777" }),
}));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({ offline: hooks.offline }),
}));
vi.mock("../src/lib/offline-images", () => ({
  offlineImageData: () =>
    hooks.downloaded ? "data:image/png;base64,DOWNLOAD" : null,
}));
vi.mock("../src/lib/rich-text-link", () => ({
  openRichTextLink: vi.fn(),
  allowRichTextNavigation: () => true,
}));

interface WebViewProps {
  source: { html: string };
  onContentProcessDidTerminate: () => void;
  onRenderProcessGone: () => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
}
function native(
  text = "![Diagram](https://fixture.invalid/image.png)",
  recovery: {
    passiveImages?: boolean;
    retryGeneration?: number;
    onImageFailure?: () => void;
    documentGeneration?: number;
    onDocumentFailure?: () => void;
    nativeMarkdown?: boolean;
  } = {},
) {
  resetRender(false);
  const result = RichText({ text, allowImages: true, ...recovery });
  flushEffects();
  return {
    result,
    view: (result as ReactElement<{ children: ReactNode }>).props
      .children as ReactElement<WebViewProps>,
  };
}
function web(
  recovery: {
    passiveImages?: boolean;
    retryGeneration?: number;
    onImageFailure?: () => void;
    documentGeneration?: number;
    onDocumentFailure?: () => void;
    nativeMarkdown?: boolean;
  } = {},
  text = "![Diagram](https://fixture.invalid/image.png)",
) {
  resetRender(true);
  return WebRichText({
    text,
    allowImages: true,
    ...recovery,
  }) as ReactElement<{ srcDoc: string }>;
}

function resetRender(web: boolean) {
  hooks.cursor = hooks.memoCursor = hooks.refCursor = hooks.effectCursor = 0;
  hooks.web = web;
}
function flushEffects() {
  hooks.pendingEffects.splice(0).forEach((effect) => effect());
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children as ReactNode)];
}
function visibleText(node: ReactNode) {
  return elements(node)
    .filter((item) => item.type === ("Text" as unknown))
    .map((item) => item.props.children);
}
beforeEach(() => {
  hooks.cursor = 0;
  hooks.memoCursor = 0;
  hooks.refs = [];
  hooks.effects = [];
  hooks.pendingEffects = [];
  hooks.states = [];
  hooks.memos = [];
  hooks.color = "#000000";
  hooks.fontScale = 1;
  hooks.offline = false;
  hooks.downloaded = false;
  hooks.effect = undefined;
  hooks.message = undefined;
  vi.stubGlobal("window", {
    addEventListener: (_name: string, callback: (event: unknown) => void) => {
      hooks.message = callback;
    },
    removeEventListener: vi.fn(),
  });
});

it("native retry re-reads newly downloaded bytes while preserving measured height", () => {
  const first = native();
  expect(first.view.props.source.html).toContain(
    'src="https://fixture.invalid/image.png"',
  );
  first.view.props.onMessage({ nativeEvent: { data: "240" } });
  hooks.downloaded = true;
  // The earlier HTML remains memoized until an explicit user retry.
  expect(native().view.props.source.html).toBe(first.view.props.source.html);
  first.view.props.onMessage({
    nativeEvent: { data: "testownik:retry-image" },
  });
  const retried = native();
  expect(retried.view.props.source.html).toContain(
    'src="data:image/png;base64,DOWNLOAD"',
  );
  expect(retried.view.props.source.html).toContain("image-attempt:1");
  expect(
    (retried.result as ReactElement<{ style: { height: number } }>).props.style
      .height,
  ).toBe(240);
});

it("native only accepts the fixed retry signal and explains missing offline images", () => {
  hooks.offline = true;
  const first = native();
  expect(first.view.props.source.html).toContain(
    "This image is not saved on this device.",
  );
  first.view.props.onMessage({
    nativeEvent: { data: "testownik:retry-image:https://outside.invalid" },
  });
  expect(native().view.props.source.html).toBe(first.view.props.source.html);
});

it("connectivity changes do not reload image-free native formatted text", () => {
  const first = native("**Question**");
  hooks.offline = true;
  expect(native("**Question**").view.props.source.html).toBe(
    first.view.props.source.html,
  );
});

it("web accepts retry only from its own frame and changes identical HTML for reload", () => {
  const first = web();
  hooks.effect!();
  hooks.message!({ source: {}, data: { testownikRetryImage: true } });
  expect(web().props.srcDoc).toBe(first.props.srcDoc);
  hooks.message!({
    source: hooks.frameWindow,
    data: { testownikRetryImage: true },
  });
  expect(web().props.srcDoc).toContain("image-attempt:1");
  expect(web().props.srcDoc).not.toBe(first.props.srcDoc);
});

it("passive native images report only current failures and rebuild only on parent retry", () => {
  const failed = vi.fn();
  const props = {
    passiveImages: true,
    retryGeneration: 7,
    onImageFailure: failed,
  };
  const first = native(undefined, props);
  expect(first.view.props.source.html).not.toContain(
    '<button class="image-retry"',
  );
  first.view.props.onMessage({
    nativeEvent: { data: "testownik:retry-image" },
  });
  expect(native(undefined, props).view.props.source.html).toBe(
    first.view.props.source.html,
  );
  first.view.props.onMessage({
    nativeEvent: { data: "testownik:image-failed:6" },
  });
  expect(failed).not.toHaveBeenCalled();
  first.view.props.onMessage({
    nativeEvent: { data: "testownik:image-failed:7" },
  });
  expect(failed).toHaveBeenCalledTimes(1);
  first.view.props.onMessage({ nativeEvent: { data: "240" } });
  hooks.downloaded = true;
  const next = native(undefined, { ...props, retryGeneration: 8 });
  expect(next.view.props.source.html).toContain(
    'src="data:image/png;base64,DOWNLOAD"',
  );
  expect(
    (next.result as ReactElement<{ style: { height: number } }>).props.style
      .height,
  ).toBe(240);
  next.view.props.onMessage({
    nativeEvent: { data: "testownik:image-failed:7" },
  });
  expect(failed).toHaveBeenCalledTimes(1);
});

it("parent retry leaves image-free native formatted text unchanged", () => {
  const first = native("**Question**", {
    passiveImages: true,
    retryGeneration: 1,
  });
  expect(
    native("**Question**", { passiveImages: true, retryGeneration: 2 }).view
      .props.source.html,
  ).toBe(first.view.props.source.html);
});

it("passive web images ignore inner retry and foreign or stale failure events", () => {
  const failed = vi.fn();
  const props = {
    passiveImages: true,
    retryGeneration: 3,
    onImageFailure: failed,
  };
  const first = web(props);
  hooks.effect!();
  expect(first.props.srcDoc).not.toContain('<button class="image-retry"');
  hooks.message!({
    source: hooks.frameWindow,
    data: { testownikRetryImage: true },
  });
  expect(web(props).props.srcDoc).toBe(first.props.srcDoc);
  hooks.message!({ source: {}, data: { testownikImageFailed: 3 } });
  hooks.message!({
    source: hooks.frameWindow,
    data: { testownikImageFailed: 2 },
  });
  expect(failed).not.toHaveBeenCalled();
  hooks.message!({
    source: hooks.frameWindow,
    data: { testownikImageFailed: 3 },
  });
  expect(failed).toHaveBeenCalledTimes(1);
  const next = web({ ...props, retryGeneration: 4 });
  expect(next.props.srcDoc).not.toBe(first.props.srcDoc);
  hooks.effect!();
  hooks.message!({
    source: hooks.frameWindow,
    data: { testownikImageFailed: 3 },
  });
  expect(failed).toHaveBeenCalledTimes(1);
});

it("parent retry leaves image-free web formatted text unchanged", () => {
  const first = web(
    { passiveImages: true, retryGeneration: 1 },
    "**Question**",
  );
  expect(
    web({ passiveImages: true, retryGeneration: 2 }, "**Question**").props
      .srcDoc,
  ).toBe(first.props.srcDoc);
});

it.each(["onContentProcessDidTerminate", "onRenderProcessGone"] as const)(
  "%s exposes inert authored content until explicit retry",
  (handler) => {
    const text = "**Question** ![Diagram](https://fixture.invalid/image.png)";
    const first = native(text);
    first.view.props.onMessage({ nativeEvent: { data: "240" } });
    const originalHtml = first.view.props.source.html;
    first.view.props[handler]();
    const failed = native(text);
    expect(visibleText(failed.result)).toContain(text);
    expect(visibleText(failed.result)).toContain(
      "Formatting could not be displayed. The content is available as text.",
    );
    expect(
      elements(failed.result).some(
        (item) => item.type === ("WebView" as unknown),
      ),
    ).toBe(false);
    hooks.downloaded = true;
    const retry = elements(failed.result).find(
      (item) => item.type === ("Button" as unknown),
    )!;
    (retry.props.onPress as () => void)();
    const recovered = native(text);
    expect(recovered.view.key).not.toBe(first.view.key);
    expect(recovered.view.props.source.html).toBe(originalHtml);
    expect(
      (recovered.result as ReactElement<{ style: { height: number } }>).props
        .style.height,
    ).toBe(240);
    first.view.props[handler]();
    expect(native(text).view.props.source.html).toBe(originalHtml);
  },
);

it("passive document failure notifies once, ignores authored messages and needs document generation even for math-only content", () => {
  const onDocumentFailure = vi.fn();
  const props = {
    passiveImages: true,
    documentGeneration: 7,
    onDocumentFailure,
  };
  const first = native("$x^2$", props);
  first.view.props.onMessage({
    nativeEvent: { data: "testownik:document-failed" },
  });
  expect(onDocumentFailure).not.toHaveBeenCalled();
  first.view.props.onContentProcessDidTerminate();
  first.view.props.onRenderProcessGone();
  expect(onDocumentFailure).toHaveBeenCalledTimes(1);
  const failed = native("$x^2$", { ...props, retryGeneration: 1 });
  expect(
    elements(failed.result).some((item) => item.type === ("Button" as unknown)),
  ).toBe(false);
  expect(
    elements(failed.result).some(
      (item) => item.type === ("WebView" as unknown),
    ),
  ).toBe(false);
  const recovered = native("$x^2$", { ...props, documentGeneration: 8 });
  expect(recovered.view.props.source.html).toBe(first.view.props.source.html);
  expect(recovered.view.key).not.toBe(first.view.key);
  first.view.props.onContentProcessDidTerminate();
  expect(onDocumentFailure).toHaveBeenCalledTimes(1);
  expect(
    native("$x^2$", { ...props, documentGeneration: 8 }).view.props.source.html,
  ).toBe(first.view.props.source.html);
});

it("old document process events do not fail changed content or an unmounted document", () => {
  const callback = vi.fn();
  const first = native("**Old**", { onDocumentFailure: callback });
  native("**New**", { onDocumentFailure: callback });
  first.view.props.onContentProcessDidTerminate();
  expect(callback).not.toHaveBeenCalled();
  const current = native("**New**", { onDocumentFailure: callback });
  hooks.effects.forEach((effect) => effect.cleanup?.());
  current.view.props.onRenderProcessGone();
  expect(callback).not.toHaveBeenCalled();
});

it("plaintext and streaming native Markdown retain their native renderers", () => {
  expect(native("Plain").result.type).toBe("Text");
  expect(native("**Stream**", { nativeMarkdown: true }).result.type).toBe(
    "Markdown",
  );
});

it("document recovery props do not reload the ordinary browser iframe", () => {
  const callback = vi.fn();
  const first = web({ documentGeneration: 1, onDocumentFailure: callback });
  expect(
    web({ documentGeneration: 2, onDocumentFailure: callback }).props.srcDoc,
  ).toBe(first.props.srcDoc);
  expect(callback).not.toHaveBeenCalled();
});

it("a failed document stays inert through reconnect, theme, font size and image-generation changes until document retry", () => {
  const text = "**Question** ![Diagram](https://fixture.invalid/image.png)";
  hooks.offline = true;
  const callback = vi.fn();
  const props = {
    passiveImages: true,
    documentGeneration: 4,
    onDocumentFailure: callback,
  };
  const first = native(text, props);
  first.view.props.onContentProcessDidTerminate();
  hooks.offline = false;
  hooks.color = "#ffffff";
  hooks.fontScale = 2;
  const failed = native(text, { ...props, retryGeneration: 2 });
  expect(visibleText(failed.result)).toContain(text);
  expect(
    elements(failed.result).some(
      (item) => item.type === ("WebView" as unknown),
    ),
  ).toBe(false);
  expect(callback).toHaveBeenCalledTimes(1);
  const recovered = native(text, {
    ...props,
    retryGeneration: 2,
    documentGeneration: 5,
  });
  expect(recovered.view.props.source.html).toContain("#ffffff");
  expect(visibleText(recovered.result)).not.toContain(text);
});

it("a changed document can fail once and returning to prior text does not restore an obsolete failure", () => {
  const callback = vi.fn();
  const first = native("**Old**", { onDocumentFailure: callback });
  first.view.props.onContentProcessDidTerminate();
  native("**Old**", { onDocumentFailure: callback });
  const current = native("**New**", { onDocumentFailure: callback });
  current.view.props.onRenderProcessGone();
  expect(callback).toHaveBeenCalledTimes(2);
  native("**New**", { onDocumentFailure: callback });
  const returned = native("**Old**", { onDocumentFailure: callback });
  expect(returned.view.props.source.html).toContain("Old");
});

it("returning to earlier authored text does not resurrect an obsolete failure", () => {
  const first = native("**Old**");
  first.view.props.onContentProcessDidTerminate();
  native("**Old**");
  native("**New**");
  const returned = native("**Old**");
  expect(returned.view.props.source.html).toContain("Old");
  returned.view.props.onContentProcessDidTerminate();
  expect(visibleText(native("**Old**").result)).toContain("**Old**");
});
