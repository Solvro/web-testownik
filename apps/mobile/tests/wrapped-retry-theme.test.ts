import { Children, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Wrapped from "../app/wrapped";
import EmbeddedWeb from "../src/components/EmbeddedWeb.native";
import type { EmbeddedTheme } from "../src/lib/embed-theme";

const hooks = vi.hoisted(() => ({
  cursor: 0,
  states: [] as unknown[],
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
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  View: "View",
  ActivityIndicator: "Spinner",
  Linking: {},
  StyleSheet: { absoluteFill: {} },
  useColorScheme: () => "light",
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { access: "synthetic-test-access" } }),
}));
vi.mock("expo-router", () => ({
  Stack: Object.assign(() => null, {
    Screen: "ScreenOptions",
    Toolbar: Object.assign(() => null, {
      Button: "ToolbarButton",
      Menu: "ToolbarMenu",
      MenuAction: "ToolbarMenuAction",
    }),
  }),
  router: { back: vi.fn() },
  useIsFocused: () => true,
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20 }),
}));
vi.mock("react-native-webview", () => ({ default: "WebView" }));
vi.mock("../modules/library-drag/src/nativeChrome", () => ({
  hideWebViewTopEdgeEffects: vi.fn(),
}));
vi.mock("../src/lib/locale", () => ({
  useLocale: () => ({ t: (_pl: string, en: string) => en }),
}));
vi.mock("../src/lib/theme", () => ({
  useTheme: () => ({ bg: "#F2F2F7", text: "#000000" }),
}));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({ user: { id: "synthetic-owner" } }),
}));
vi.mock("../src/lib/storage", () => ({
  tokenStore: { session: () => "synthetic-session" },
}));
vi.mock("../src/lib/api", () => ({
  api: { forSession: () => ({}) },
  WEB_URL: "https://fixture.invalid",
}));
vi.mock("../src/components/EmbeddedWeb", () => ({ default: "EmbeddedPage" }));
vi.mock("../src/components/Overflow", () => ({ default: "Overflow" }));
vi.mock("../src/components/ui", () => ({
  ErrorScreen: "ErrorScreen",
  Loading: "Loading",
}));

interface Props {
  children?: ReactNode;
  backgroundColor?: string;
  color?: string;
  loadingBackground?: string;
  onRetry?: () => void;
  onTheme?: (theme: EmbeddedTheme) => void;
  renderLoading?: () => ReactElement<Props>;
  style?: unknown;
}
function find(node: ReactNode, type: string): ReactElement<Props> {
  for (const child of Children.toArray(node)) {
    if (typeof child !== "object" || !("props" in child)) continue;
    const element = child as ReactElement<Props>;
    if ((element.type as unknown) === type) return element;
    if (element.props.children) {
      try {
        return find(element.props.children, type);
      } catch {}
    }
  }
  throw new Error(`Missing rendered ${type}`);
}
function page() {
  hooks.cursor = 0;
  return find(Wrapped(), "EmbeddedPage");
}

beforeEach(() => {
  hooks.cursor = 0;
  hooks.states = [];
});

it("restores readable native loading contrast after a light-theme error and retry", () => {
  const first = page();
  first.props.onTheme!({
    background: "#F2F2F7",
    foreground: "#000000",
    dark: false,
  });
  expect(page().props.loadingBackground).toBe("#F2F2F7");
  page().props.onRetry!();
  const retried = page();
  expect(retried.props.loadingBackground).toBe("#15171c");

  hooks.cursor = 0;
  hooks.states = [];
  const native = EmbeddedWeb({
    access: "synthetic-test-access",
    onRetry: vi.fn(),
    loadingBackground: retried.props.loadingBackground,
  });
  const loading = find(native, "WebView").props.renderLoading!();
  expect(loading.props.style).toContainEqual(
    expect.objectContaining({ backgroundColor: "#15171c" }),
  );
  expect(find(loading, "Spinner").props.color).toBe("#ffffff");
});
