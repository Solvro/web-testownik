// Native semester journal: scan real results, then experiment with visible grade choices.
// Uses the established Testownik native system; predictions are local and share web math.
import type { GradesData } from "@testownik/core/user/types";
import {
  buildCourseView,
  earnedEcts,
  projectedAverage,
  termGradeOptions,
  totalEcts,
  weightedAverage,
} from "@testownik/core/grades/utils";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Choice from "../../../src/components/grades/GradesPicker";
import GradeSheet from "../../../src/components/grades/GradeSheet";
import GradeDetails from "../../../src/components/grades/GradeDetails";
import GradeBadge from "../../../src/components/grades/GradeBadge";
import GradeMenu from "../../../src/components/grades/GradeMenu";
import GradesContent from "../../../src/components/grades/GradesContent";
import SemesterChart, {
  Sparkline,
} from "../../../src/components/grades/SemesterChart";
import { gradeSymbol, gradeTone, termLabel } from "../../../src/lib/grades-ui";
import {
  ErrorScreen,
  ErrorState,
  Heading,
  Label,
  Loading,
  Screen,
} from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { loadGrades } from "../../../src/lib/grades";
import { useLocale } from "../../../src/lib/locale";
import { useSession } from "../../../src/lib/session";
import { useTheme } from "../../../src/lib/theme";

export default function Grades() {
  const s = useSession(),
    c = useTheme(),
    insets = useSafeAreaInsets();
  const { t, language } = useLocale();
  const scroll = useRef<ScrollView>(null);
  const dark = useColorScheme() === "dark";
  const nativeIOS = Platform.OS === "ios";
  const [term, setTerm] = useState<string | null>(null);
  const [mode, setMode] = useState("grades");
  // Term scopes also keep predictions independent if USOS repeats a course id.
  const [scenarios, setScenarios] = useState<
    Record<string, Record<string, number>>
  >({});
  const [selection, setSelection] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<"semesters" | "combined" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [scrolledPast, setScrolledPast] = useState(false);
  const result = useQuery({
    queryKey: ["grades", s.user?.id],
    queryFn: () => loadGrades(() => api.request<GradesData>("grades/")),
    enabled: s.user?.account_type === "student",
    staleTime: 5 * 60 * 1000,
  });
  const terms = useMemo(
    () =>
      [...(result.data?.terms ?? [])].sort((a, b) =>
        b.start_date.localeCompare(a.start_date),
      ),
    [result.data],
  );
  const selectedTerm =
    terms.find((item) => item.id === term) ??
    terms.find((item) => item.is_current) ??
    terms[0];
  const termId = selectedTerm?.id ?? "";
  const termIndex = terms.findIndex((item) => item.id === termId);
  const courses = useMemo(
    () =>
      (result.data?.courses ?? []).map((course) => ({
        ...buildCourseView(course, language),
        termId: course.term_id,
      })),
    [result.data, language],
  );
  const termCourses = useMemo(
    () => courses.filter((course) => course.termId === termId),
    [courses, termId],
  );
  const overrides = scenarios[termId] ?? {};
  const choices = termGradeOptions(termCourses);
  const selectedTerms = (
    selection ?? terms.slice(0, 2).map((item) => item.id)
  ).filter((id) => terms.some((item) => item.id === id));
  const combined = courses.filter((course) =>
    selectedTerms.includes(course.termId),
  );
  const average = weightedAverage(termCourses),
    projected = projectedAverage(termCourses, overrides);
  const difference =
    projected != null && average != null ? projected - average : null;
  const changedCount = termCourses.filter(
    (course) => overrides[course.id] != null,
  ).length;
  const previous = terms[termIndex + 1];
  const previousAverage = previous
    ? weightedAverage(courses.filter((course) => course.termId === previous.id))
    : null;
  const termAverage = (id: string) =>
    weightedAverage(courses.filter((course) => course.termId === id));
  const fmt = (value: number | null, digits = 2) =>
    value == null
      ? "—"
      : value.toLocaleString(language === "pl" ? "pl-PL" : "en-GB", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${fmt(Math.abs(value), 3)}`;
  const chooseTerm = (id: string) => {
    setTerm(id);
    setDetail(null);
    setSheet(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const toggleTerm = (id: string) =>
    setSelection(
      selectedTerms.includes(id)
        ? selectedTerms.filter((other) => other !== id)
        : [...selectedTerms, id],
    );
  const setGrade = (id: string, value: number | null) =>
    setScenarios((previous) => {
      const next = { ...previous[termId] };
      if (
        value == null ||
        value === termCourses.find((course) => course.id === id)?.mainValue
      )
        delete next[id];
      else next[id] = value;
      return { ...previous, [termId]: next };
    });
  // Stack.Toolbar drops SF-symbol menus on Android; use the inline semester bar.
  const native = nativeIOS;
  // iOS predicts grades from a menu on each badge instead of a segmented row.
  const menuInline = nativeIOS && mode === "simulator";
  const header = (
    <>
      <Stack.Screen
        options={{
          title: t("Oceny", "Grades"),
          headerLargeTitleEnabled: true,
          headerTransparent: nativeIOS ? true : undefined,
        }}
      />
      {native && terms.length ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon="calendar"
            accessibilityLabel={t("Wybierz semestr", "Choose semester")}
          >
            <Stack.Toolbar.Menu inline title={t("Semestr", "Semester")}>
              {terms.map((item) => (
                <Stack.Toolbar.MenuAction
                  key={item.id}
                  isOn={item.id === termId}
                  subtitle={[
                    item.is_current ? t("Bieżący", "Current") : null,
                    `${t("Średnia", "Average")} ${fmt(termAverage(item.id))}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={() => chooseTerm(item.id)}
                >
                  {termLabel(item.name, t)}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.MenuAction
              icon="sum"
              onPress={() => setSheet("combined")}
            >
              {t("Wszystkie semestry", "All Semesters")}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
    </>
  );
  if (s.user?.account_type !== "student")
    return (
      <Screen>
        {header}
        <Heading>{t("Oceny z USOS", "Your USOS Grades")}</Heading>
        <Label muted>
          {t(
            "Połącz konto studenckie z USOS, aby zobaczyć oceny i planować wyniki.",
            "Connect a student account through USOS to see grades and plan your results.",
          )}
        </Label>
      </Screen>
    );
  if (result.isPending)
    return (
      <>
        {header}
        <Loading />
      </>
    );
  if (result.error && !result.data)
    return (
      <>
        {header}
        <ErrorScreen error={result.error} retry={() => void result.refetch()} />
      </>
    );
  const selectedCourse = termCourses.find((item) => item.id === detail);
  // Android renders a Material 3 layout from the same state.
  if (Platform.OS === "android")
    return (
      <GradesContent
        header={header}
        terms={terms}
        termId={termId}
        termIndex={termIndex}
        chooseTerm={chooseTerm}
        termAverage={termAverage}
        mode={mode}
        setMode={setMode}
        termCourses={termCourses}
        overrides={overrides}
        choices={choices}
        setGrade={setGrade}
        resetPredictions={() =>
          setScenarios((previous) => ({ ...previous, [termId]: {} }))
        }
        average={average}
        projected={projected}
        difference={difference}
        changedCount={changedCount}
        previous={previous}
        previousAverage={previousAverage}
        sheet={sheet}
        setSheet={setSheet}
        detail={detail}
        setDetail={setDetail}
        selectedTerms={selectedTerms}
        toggleTerm={toggleTerm}
        setSelection={setSelection}
        combinedAverage={weightedAverage(combined)}
        combinedEcts={totalEcts(combined)}
        overallAverage={weightedAverage(courses)}
        fmt={fmt}
        signed={signed}
        error={result.error}
        refreshing={result.isRefetching}
        refresh={() => void result.refetch()}
      />
    );
  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        scrollEventThrottle={32}
        onScroll={(event) => {
          // Once the summary card scrolls away, a floating pill keeps the forecast in view.
          const past = event.nativeEvent.contentOffset.y > 120;
          if (past !== scrolledPast) setScrolledPast(past);
        }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (mode === "simulator" ? 100 : 32),
        }}
        refreshControl={
          <RefreshControl
            refreshing={result.isRefetching}
            onRefresh={() => void result.refetch()}
            tintColor={c.primary}
          />
        }
      >
        <View style={styles.column}>
          {terms.length && !native ? (
            <View style={[styles.termBar, { backgroundColor: c.surface }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Poprzedni semestr", "Previous semester")}
                accessibilityState={{ disabled: !previous }}
                disabled={!previous}
                onPress={() => chooseTerm(previous.id)}
                style={styles.arrow}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={previous ? c.primary : c.border}
                />
              </Pressable>
              <Pressable
                testID="choose-semester"
                accessibilityRole="button"
                accessibilityLabel={t("Wybierz semestr", "Choose semester")}
                onPress={() => setSheet("semesters")}
                style={{ flex: 1, paddingVertical: 12, gap: 4 }}
              >
                <Text
                  style={{ color: c.muted, fontSize: 12, textAlign: "center" }}
                >
                  {t("Semestr", "Semester")}
                </Text>
                <Text
                  style={{
                    color: c.text,
                    fontSize: 16,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {selectedTerm?.name}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Następny semestr", "Next semester")}
                accessibilityState={{ disabled: termIndex <= 0 }}
                disabled={termIndex <= 0}
                onPress={() => chooseTerm(terms[termIndex - 1].id)}
                style={styles.arrow}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={termIndex > 0 ? c.primary : c.border}
                />
              </Pressable>
            </View>
          ) : null}
          <Choice
            segmented
            label={t("Widok ocen", "Grades view")}
            value={mode}
            options={[
              { value: "grades", label: t("Oceny", "Grades") },
              { value: "simulator", label: t("Symulator", "Simulator") },
            ]}
            onChange={setMode}
          />
          {result.error ? (
            <ErrorState
              error={result.error}
              retry={() => void result.refetch()}
            />
          ) : null}
        </View>
        <View style={styles.column}>
          <View
            style={{
              marginTop: 12,
              padding: 16,
              gap: 16,
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: c.surface,
            }}
          >
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {selectedTerm ? termLabel(selectedTerm.name, t) : null}
                </Text>
                <Text style={{ color: c.text, fontSize: 15 }}>
                  {mode === "simulator"
                    ? t("Prognozowana średnia", "Projected average")
                    : t("Średnia ważona", "Weighted average")}
                </Text>
                <Text
                  testID="grade-average"
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.average,
                    {
                      color: gradeTone(
                        mode === "simulator" ? projected : average,
                        c,
                        dark,
                      ).fg,
                    },
                  ]}
                >
                  {fmt(mode === "simulator" ? projected : average, 3)}
                </Text>
                {mode === "simulator" ? (
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    USOS {fmt(average, 3)} ·{" "}
                    <Text
                      style={{
                        color:
                          difference == null || Math.abs(difference) < 0.0005
                            ? c.muted
                            : difference < 0
                              ? c.danger
                              : c.success,
                        fontWeight: "600",
                      }}
                    >
                      {difference != null ? signed(difference) : "—"}
                    </Text>
                  </Text>
                ) : average != null && previousAverage != null ? (
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {signed(average - previousAverage)} · {t("względem", "vs")}{" "}
                    {previous ? termLabel(previous.name, t) : null}
                  </Text>
                ) : null}
              </View>
            </View>
            {mode === "simulator" ? (
              <View
                style={[
                  styles.row,
                  {
                    paddingTop: 12,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={{ flex: 1, color: c.muted, fontSize: 13 }}>
                  {t(
                    `Zmienione oceny: ${changedCount}`,
                    `Changed grades: ${changedCount}`,
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    "Resetuj prognozę",
                    "Reset predictions",
                  )}
                  disabled={!changedCount}
                  accessibilityState={{ disabled: !changedCount }}
                  onPress={() =>
                    setScenarios((previous) => ({ ...previous, [termId]: {} }))
                  }
                  style={{
                    minHeight: 32,
                    justifyContent: "center",
                    opacity: changedCount ? 1 : 0.45,
                  }}
                >
                  <Text style={{ color: c.primary, fontSize: 16 }}>
                    {t("Resetuj", "Reset")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.row,
                  {
                    paddingTop: 16,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderColor: c.border,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{ color: c.text, fontSize: 20, fontWeight: "600" }}
                  >
                    {termCourses.filter((course) => course.passed).length} /{" "}
                    {termCourses.length}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {t("Zaliczone przedmioty", "Courses passed")}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{ color: c.text, fontSize: 20, fontWeight: "600" }}
                  >
                    {fmt(earnedEcts(termCourses), 1)} /{" "}
                    {fmt(totalEcts(termCourses), 1)}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {t("Zdobyte ECTS", "ECTS earned")}
                  </Text>
                </View>
              </View>
            )}
          </View>
          {terms.length > 1 && mode === "grades" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                "Wszystkie semestry, porównaj semestry i policz wspólną średnią",
                "All Semesters, compare semesters and combine averages",
              )}
              onPress={() => setSheet("combined")}
              style={({ pressed }) => ({
                marginTop: 12,
                padding: 16,
                gap: 12,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: pressed ? c.fill : c.surface,
              })}
            >
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{ color: c.text, fontSize: 17, fontWeight: "600" }}
                  >
                    {t("Wszystkie semestry", "All Semesters")}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>
                    {t(
                      "Porównaj semestry i policz wspólną średnią",
                      "Compare semesters and combine averages",
                    )}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </View>
              <Sparkline
                values={[...terms]
                  .reverse()
                  .map((item) => termAverage(item.id))}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.column, { paddingTop: 20, gap: 12 }]}>
          {mode === "simulator" ? (
            <Label muted>
              {t(
                "Wybierz ocenę i od razu zobacz wynik. Symulacja nie zmienia ocen w USOS.",
                "Choose a grade to see its impact immediately. Your USOS grades stay unchanged.",
              )}
            </Label>
          ) : (
            <Text
              accessibilityRole="header"
              style={{ fontSize: 21, fontWeight: "700", color: c.text }}
            >
              {t("Przedmioty", "Courses")}
            </Text>
          )}
          {!termCourses.length ? (
            <View style={{ paddingVertical: 24, gap: 8 }}>
              <Label>{t("Nie ma jeszcze ocen", "No Grades Yet")}</Label>
              <Label muted>
                {t(
                  "Wybierz inny semestr lub przeciągnij w dół, aby odświeżyć dane z USOS.",
                  "Choose another semester or pull down to refresh your USOS results.",
                )}
              </Label>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: c.surface,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {termCourses.map((item, index) => {
                const prediction =
                  mode === "simulator" ? overrides[item.id] : undefined;
                const displayedValue = prediction ?? item.mainValue;
                const originalLabel =
                  item.mainValue == null
                    ? item.hero
                      ? gradeSymbol(item.hero.symbol, t)
                      : "—"
                    : fmt(item.mainValue, 1);
                const displayedLabel =
                  prediction == null ? originalLabel : fmt(prediction, 1);
                return (
                  <View
                    key={item.id}
                    style={{
                      paddingHorizontal: 16,
                      borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                      borderColor: c.border,
                    }}
                  >
                    <View style={styles.row}>
                      <Pressable
                        testID={`grade-course-${item.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={
                          prediction == null
                            ? `${item.name}, ${originalLabel}`
                            : `${item.name}, ${t("Prognoza", "Predicted")}: ${displayedLabel}, USOS: ${originalLabel}`
                        }
                        onPress={() => setDetail(item.id)}
                        style={[styles.row, { flex: 1, paddingVertical: 14 }]}
                      >
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ fontSize: 17, color: c.text }}>
                            {item.name}
                          </Text>
                          <Text style={{ color: c.muted, fontSize: 13 }}>
                            {fmt(item.ects, 1)} ECTS ·{" "}
                            {mode === "simulator"
                              ? prediction == null
                                ? "USOS"
                                : `${t("Prognoza", "Prediction")} · USOS ${originalLabel}`
                              : item.passed
                                ? t("Zaliczony", "Passed")
                                : item.mainValue != null && item.mainValue < 3
                                  ? t("Niezaliczony", "Not passed")
                                  : t("W toku", "In progress")}
                          </Text>
                        </View>
                        {menuInline ? null : (
                          <>
                            <GradeBadge
                              testID={`grade-value-${item.id}`}
                              value={displayedValue}
                              label={displayedLabel}
                            />
                            <Ionicons
                              name="chevron-forward"
                              size={14}
                              color={c.muted}
                            />
                          </>
                        )}
                      </Pressable>
                      {menuInline ? (
                        <GradeMenu
                          label={t(
                            `Prognoza: ${item.name}`,
                            `Prediction: ${item.name}`,
                          )}
                          value={displayedValue}
                          display={displayedLabel}
                          options={choices.map((value) => ({
                            value,
                            label: fmt(value, 1),
                          }))}
                          predicted={prediction != null}
                          onChange={(value) => setGrade(item.id, value)}
                          onRestore={() => setGrade(item.id, null)}
                        />
                      ) : null}
                    </View>
                    {mode === "simulator" && !menuInline ? (
                      <View style={{ gap: 4, paddingBottom: 12 }}>
                        <Choice
                          segmented
                          label={t(
                            `Prognoza: ${item.name}`,
                            `Prediction: ${item.name}`,
                          )}
                          value={String(
                            overrides[item.id] ?? item.mainValue ?? "",
                          )}
                          options={choices.map((value) => ({
                            value: String(value),
                            label: fmt(value, 1),
                          }))}
                          onChange={(value) => setGrade(item.id, Number(value))}
                        />
                        {overrides[item.id] != null ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t(
                              `Przywróć ocenę z USOS: ${item.name}`,
                              `Restore USOS grade: ${item.name}`,
                            )}
                            onPress={() => setGrade(item.id, null)}
                            style={{ minHeight: 44, justifyContent: "center" }}
                          >
                            <Text style={{ color: c.primary, fontSize: 14 }}>
                              {t("Przywróć ocenę z USOS", "Restore USOS Grade")}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      {mode === "simulator" && scrolledPast && projected != null ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            alignSelf: "center",
            bottom: insets.bottom + 72,
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 22,
            backgroundColor: c.surface,
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          }}
        >
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {t("Prognoza", "Forecast")}
          </Text>
          <Text
            style={{
              color: gradeTone(projected, c, dark).fg,
              fontSize: 20,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {fmt(projected, 3)}
          </Text>
          {difference != null && Math.abs(difference) >= 0.0005 ? (
            <Text
              style={{
                color: difference < 0 ? c.danger : c.success,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {signed(difference)}
            </Text>
          ) : null}
        </View>
      ) : null}
      {selectedCourse ? (
        <GradeDetails course={selectedCourse} onClose={() => setDetail(null)} />
      ) : null}
      {sheet ? (
        <GradeSheet
          title={
            sheet === "semesters"
              ? t("Wybierz semestr", "Choose Semester")
              : t("Wszystkie semestry", "All Semesters")
          }
          onClose={() => setSheet(null)}
        >
          {sheet === "combined" ? (
            <>
              <View style={{ gap: 4 }}>
                <Text style={{ color: c.muted, fontSize: 15 }}>
                  {t("Średnia ważona", "Weighted average")}
                </Text>
                <Text
                  testID="combined-average"
                  style={[
                    styles.average,
                    { color: gradeTone(weightedAverage(combined), c, dark).fg },
                  ]}
                >
                  {fmt(weightedAverage(combined), 3)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {t(
                    `Wybrane semestry: ${selectedTerms.length}`,
                    `Selected semesters: ${selectedTerms.length}`,
                  )}{" "}
                  · {fmt(totalEcts(combined), 1)} ECTS
                </Text>
              </View>
              <View
                style={{
                  paddingVertical: 16,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  backgroundColor: c.surface,
                }}
              >
                <SemesterChart
                  points={[...terms].reverse().map((item) => ({
                    id: item.id,
                    label: termLabel(item.name, t),
                    average: termAverage(item.id),
                    selected: selectedTerms.includes(item.id),
                  }))}
                  format={(value) => fmt(value)}
                  onToggle={toggleTerm}
                  combined={weightedAverage(courses)}
                />
              </View>
              <View style={[styles.row, { paddingHorizontal: 4 }]}>
                <Text
                  accessibilityRole="header"
                  style={{ flex: 1, color: c.muted, fontSize: 13 }}
                >
                  {t(
                    "Każda ocena jest ważona punktami ECTS.",
                    "Each grade is weighted by its ECTS credits.",
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    setSelection(
                      selectedTerms.length === terms.length
                        ? []
                        : terms.map((item) => item.id),
                    )
                  }
                >
                  <Text style={{ color: c.primary, fontSize: 15 }}>
                    {selectedTerms.length === terms.length
                      ? t("Odznacz wszystkie", "Deselect All")
                      : t("Zaznacz wszystkie", "Select All")}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
          <View
            style={{
              borderRadius: 16,
              borderCurve: "continuous",
              backgroundColor: c.surface,
              overflow: "hidden",
            }}
          >
            {terms.map((item, index) => {
              const checked =
                sheet === "combined"
                  ? selectedTerms.includes(item.id)
                  : item.id === termId;
              const value = termAverage(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole={
                    sheet === "combined" ? "checkbox" : "radio"
                  }
                  accessibilityLabel={item.name}
                  accessibilityState={{ checked }}
                  onPress={() =>
                    sheet === "semesters"
                      ? chooseTerm(item.id)
                      : toggleTerm(item.id)
                  }
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      minHeight: 56,
                      borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                      borderColor: c.border,
                      backgroundColor: pressed ? c.fill : "transparent",
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: c.text, fontSize: 17 }}>
                      {termLabel(item.name, t)}
                    </Text>
                    {item.is_current ? (
                      <Text style={{ color: c.muted, fontSize: 13 }}>
                        {t("Bieżący semestr", "Current semester")}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      color: gradeTone(value, c, dark).fg,
                      fontSize: 17,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {fmt(value)}
                  </Text>
                  <View style={{ width: 22, alignItems: "center" }}>
                    {checked ? (
                      <Ionicons name="checkmark" size={20} color={c.primary} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </GradeSheet>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  column: {
    paddingHorizontal: 20,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  termBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    marginBottom: 10,
  },
  arrow: {
    width: 44,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  average: { fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
