import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

const state = vi.hoisted(() => ({
  cursor: 0,
  refCursor: 0,
  effectCursor: 0,
  dirty: false,
  values: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  question: "q1",
  quiz: {
    id: "study-doc",
    title: "Recovery",
    questions: [
      {
        id: "q1",
        text: "Question one",
        multiple: false,
        answers: [{ id: "a1", text: "**Answer one**", is_correct: true }],
      },
      {
        id: "q2",
        text: "Question two",
        multiple: false,
        answers: [{ id: "a2", text: "**Answer two**", is_correct: true }],
      },
    ],
    current_session: {
      id: "session",
      current_question: "q1",
      answers: [],
      study_time: 0,
    },
  },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = state.cursor++;
    if (!(i in state.values))
      state.values[i] = typeof initial === "function" ? initial() : initial;
    return [
      state.values[i],
      (next: unknown) => {
        const value = typeof next === "function" ? next(state.values[i]) : next;
        if (value !== state.values[i]) state.dirty = true;
        state.values[i] = value;
      },
    ];
  },
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (fn: unknown) => fn,
  useRef: (initial: unknown) => {
    const i = state.refCursor++;
    return state.refs[i] ?? (state.refs[i] = { current: initial });
  },
  useLayoutEffect: (
    effect: () => undefined | (() => void),
    deps: unknown[],
  ) => {
    const i = state.effectCursor++;
    const old = state.effects[i];
    if (!old || old.deps.some((v, n) => !Object.is(v, deps[n]))) {
      old?.cleanup?.();
      state.effects[i] = { deps, cleanup: effect() };
    }
  },
  useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
    const i = state.effectCursor++;
    const old = state.effects[i];
    if (!old || old.deps.some((v, n) => !Object.is(v, deps[n])))
      state.pending.push(() => {
        old?.cleanup?.();
        state.effects[i] = { deps, cleanup: effect() };
      });
  },
}));
vi.mock("@testownik/core/quiz/session", () => ({
  deriveSettings: () => ({}),
  resolveCurrentQuestion: (quiz: typeof state.quiz) =>
    quiz.questions.find((q) => q.id === state.question),
  ensureQuizCurrentQuestion: (q: unknown) => q,
  getMasteredCount: () => 0,
  isQuizComplete: () => false,
  checkAnswerCorrectness: () => true,
  pickNextQuestion: () => null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "quiz" ? state.quiz : null,
    refetch: vi.fn(),
    isFetching: false,
    isLoading: false,
  }),
  useQueryClient: () => ({
    getQueryData: () => state.quiz,
    invalidateQueries: vi.fn(),
  }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "record" }));
vi.mock("expo-router", () => ({
  Stack: Object.assign("Stack", {
    Screen: "ScreenOptions",
    Toolbar: Object.assign("Toolbar", {
      Button: "ToolbarButton",
      Spacer: "Spacer",
      Menu: "Menu",
      MenuAction: "MenuAction",
    }),
  }),
  router: { push: vi.fn(), replace: vi.fn(), navigate: vi.fn(), back: vi.fn() },
  useLocalSearchParams: () => ({ id: "study-doc" }),
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
}));
vi.mock("react-native", () => ({
  Text: "Text",
  View: "View",
  ScrollView: "ScrollView",
  Platform: { OS: "ios" },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    ready: true,
    user: { id: "owner" },
    library: {},
    offline: false,
    pending: 0,
  }),
}));
vi.mock("../src/lib/theme", () => ({ useTheme: () => ({}) }));
vi.mock("../src/lib/locale", () => ({
  useLocale: () => ({ t: (_pl: string, en: string) => en }),
}));
vi.mock("../src/lib/api", () => ({
  API_URL: "http://localhost",
  api: { forSession: () => ({}) },
}));
vi.mock("../src/lib/haptics", () => ({
  haptics: { selection: vi.fn(), success: vi.fn() },
}));
vi.mock("../src/lib/accessibility-feedback", () => ({
  createCompletionAnnouncement: () => vi.fn(),
}));
vi.mock("../src/lib/offline-images", () => ({
  saveQuizImages: vi.fn(),
  removeQuizImages: vi.fn(),
}));
vi.mock("../src/lib/use-refresh-on-recovery", () => ({
  useRefreshOnRecovery: vi.fn(),
}));
vi.mock("../src/lib/use-ai-response", () => ({ useAiResponse: vi.fn() }));
vi.mock("../src/components/header-action", () => ({ headerMenus: () => [] }));
vi.mock("../src/components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Label: "Label",
  Loading: "Loading",
  ErrorScreen: "ErrorScreen",
  notify: vi.fn(),
  useConfirm: () => vi.fn(),
}));
for (const [path, name] of [
  ["native/EditorAction", "EditorAction"],
  ["StudyImage", "StudyImage"],
  ["ExternalImageNotice", "ExternalImageNotice"],
  ["PressableScale", "PressableScale"],
  ["RichText", "RichText"],
  ["SyncStatus", "SyncStatus"],
  ["native/OptionIndicator", "OptionIndicator"],
  ["native/ResultIcon", "ResultIcon"],
  ["QuizCompleteCard", "QuizCompleteCard"],
  ["QuizStorageNotice", "QuizStorageNotice"],
])
  vi.doMock(`../src/components/${path}`, () => ({ default: name }));
vi.mock("../src/components/InlineHint", () => ({
  default: "InlineHint",
  AnswerHint: "AnswerHint",
}));
const { default: Study } = await import("../app/quiz/[id]");
function all(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const item = node as ReactElement<Record<string, unknown>>;
  if (typeof item.type === "function" && item.type.name === "HintScope")
    return all(
      (item.type as (props: Record<string, unknown>) => ReactNode)(item.props),
    );
  return [item, ...all(item.props.children as ReactNode)];
}
function render(flushPassive = true) {
  let tree: ReactNode;
  do {
    state.dirty = false;
    state.cursor = state.refCursor = state.effectCursor = 0;
    tree = Study();
    if (flushPassive) state.pending.splice(0).forEach((fn) => fn());
  } while (state.dirty);
  return all(tree);
}
function answer(tree: ReturnType<typeof render>) {
  return tree.find(
    (item) => item.type === ("RichText" as unknown) && item.props.passiveImages,
  )!;
}
function action(tree: ReturnType<typeof render>, id: string) {
  return tree.find((item) => item.props.testID === id);
}
beforeEach(() => {
  state.values = [];
  state.refs = [];
  state.effects = [];
  state.pending = [];
  state.question = "q1";
  state.quiz.current_session.current_question = "q1";
});
it("Study owns answer document retry outside radio and preserves selection through retry", () => {
  let tree = render();
  const radio = tree.find((item) => item.props.accessibilityRole === "radio")!;
  (radio.props.onPress as () => void)();
  tree = render();
  const first = answer(tree);
  (first.props.onImageFailure as () => void)();
  (first.props.onDocumentFailure as () => void)();
  tree = render();
  expect(action(tree, "retry-answer-images")).toBeUndefined();
  const retry = action(tree, "retry-answer-content")!;
  expect(retry).toBeDefined();
  const enclosingRadio = tree.find(
    (item) => item.props.accessibilityRole === "radio",
  )!;
  expect(all(enclosingRadio).includes(retry)).toBe(false);
  expect(enclosingRadio.props.accessibilityState).toMatchObject({
    checked: true,
  });
  (retry.props.onPress as () => void)();
  tree = render();
  expect(answer(tree).props.documentGeneration).toBe(1);
  expect(
    tree.find((item) => item.props.accessibilityRole === "radio")!.props
      .accessibilityState,
  ).toMatchObject({ checked: true });
  expect(action(tree, "retry-answer-images")).toBeUndefined();
  (first.props.onDocumentFailure as () => void)();
  tree = render();
  expect(
    tree.some(
      (item) =>
        item.props.children ===
        "Answer formatting is unavailable. The content is available as text.",
    ),
  ).toBe(false);
});
it("Study rejects old question callbacks and clears the old document panel when returning", () => {
  const first = answer(render());
  (first.props.onDocumentFailure as () => void)();
  expect(action(render(), "retry-answer-content")).toBeDefined();
  state.question = "q2";
  state.quiz.current_session.current_question = "q2";
  let tree = render();
  expect(action(tree, "retry-answer-content")).toBeUndefined();
  (first.props.onDocumentFailure as () => void)();
  expect(action(render(), "retry-answer-content")).toBeUndefined();
  const second = answer(tree);
  (second.props.onDocumentFailure as () => void)();
  expect(action(render(), "retry-answer-content")).toBeDefined();
  state.question = "q1";
  state.quiz.current_session.current_question = "q1";
  tree = render();
  expect(action(tree, "retry-answer-content")).toBeUndefined();
  (second.props.onDocumentFailure as () => void)();
  expect(action(render(), "retry-answer-content")).toBeUndefined();
});

it("Study exposes passive-answer recovery for a process failure before passive effects flush", () => {
  const current = answer(render(false));
  (current.props.onDocumentFailure as () => void)();
  expect(action(render(false), "retry-answer-content")).toBeDefined();
});
