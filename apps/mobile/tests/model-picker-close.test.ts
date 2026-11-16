import { Children, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import SettingsModel from "../app/settings-model";

const mocks = vi.hoisted(() => ({
  saving: false,
  models: {} as Record<string, unknown>,
  override: {} as Record<string, unknown>,
  back: vi.fn(),
  replace: vi.fn(),
  select: vi.fn(),
  canGoBack: vi.fn(() => true),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: () => undefined,
  useRef: (value: unknown) => ({ current: value }),
  useState: (initial: unknown) => [
    typeof initial === "boolean"
      ? mocks.saving
      : typeof initial === "function"
        ? initial()
        : initial,
    vi.fn(),
  ],
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  ActivityIndicator: "Progress",
  View: "View",
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => mocks.models }));
vi.mock("expo-router", () => ({
  Stack: Object.assign(() => null, {
    Screen: "ScreenOptions",
    Toolbar: Object.assign(() => null, { Button: "ToolbarButton" }),
  }),
  router: {
    back: mocks.back,
    replace: mocks.replace,
    canGoBack: mocks.canGoBack,
  },
  useLocalSearchParams: () => ({ quiz: "quiz" }),
  useNavigation: () => ({ dispatch: vi.fn() }),
}));
vi.mock("expo-router/react-navigation", () => ({
  usePreventRemove: () => undefined,
}));
vi.mock("../src/lib/quiz-ai-model", () => ({
  useQuizAiModel: () => mocks.override,
}));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({ user: { id: "fixture" } }),
}));
vi.mock("../src/lib/locale", () => ({
  useLocale: () => ({ t: (_pl: string, en: string) => en }),
}));
vi.mock("../src/lib/api", () => ({ api: { forSession: () => ({}) } }));
vi.mock("../src/lib/haptics", () => ({ haptics: { selection: vi.fn() } }));
vi.mock("../src/lib/use-study-settings", () => ({ useStudySettings: vi.fn() }));
vi.mock("../src/components/settings/ModelList", () => ({
  default: "ModelList",
}));
vi.mock("../src/components/ui", () => ({
  ErrorScreen: "Error",
  Label: "Label",
  Loading: "Loading",
  notify: vi.fn(),
}));

interface ControlProps {
  children?: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress?: () => void;
}
function findClose(node: ReactNode): ReactElement<ControlProps> | undefined {
  for (const child of Children.toArray(node)) {
    if (typeof child !== "object" || !("props" in child)) continue;
    const element = child as ReactElement<ControlProps>;
    if (element.props.accessibilityLabel === "Close model picker")
      return element;
    const nested = findClose(element.props.children);
    if (nested) return nested;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canGoBack.mockReturnValue(true);
  mocks.saving = false;
  mocks.override = {
    accountLoaded: true,
    accountModel: null,
    select: mocks.select,
  };
  mocks.models = { data: { models: [], default_model: null } };
});

it.each(["loading", "quiz error", "models error", "ready"])(
  "keeps an explicit iOS close action reachable during %s without selecting a model",
  (state) => {
    if (state === "loading") mocks.models = { isPending: true };
    if (state === "quiz error")
      mocks.override.overrideError = new Error("failed");
    if (state === "models error") mocks.models = { error: new Error("failed") };
    const close = findClose(SettingsModel());
    expect(close).toBeDefined();
    expect(close!.props.disabled).toBe(false);
    close!.props.onPress!();
    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.select).not.toHaveBeenCalled();
  },
);

it("disables close while a model save is pending", () => {
  mocks.saving = true;
  expect(findClose(SettingsModel())!.props.disabled).toBe(true);
});

it("returns to the app root when opened without a previous route", () => {
  mocks.canGoBack.mockReturnValue(false);
  findClose(SettingsModel())!.props.onPress!();
  expect(mocks.replace).toHaveBeenCalledWith("/");
  expect(mocks.back).not.toHaveBeenCalled();
});
