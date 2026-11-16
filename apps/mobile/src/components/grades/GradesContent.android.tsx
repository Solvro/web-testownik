import { earnedEcts, totalEcts } from "@testownik/core/grades/utils";
import {
  Card,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Icon,
  IconButton,
  ListItem,
  OutlinedButton,
  Row,
  Shape,
  Surface,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  padding,
  paddingAll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text as RNText,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { gradeSymbol, gradeTone, termLabel } from "../../lib/grades-ui";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { CollectionHeading, segmentRadius } from "../Collection.android";
import M3Host from "../native/M3Host";
import { symbol } from "../native/materialIcons.android";
import { ErrorState, Label } from "../ui";
import GradeDetails from "./GradeDetails";
import GradeSheet from "./GradeSheet.android";
import GradesPicker from "./GradesPicker.android";
import type { GradesContentProps, TermCourse } from "./GradesContent.types";
import SemesterChart, { Sparkline } from "./SemesterChart";

// Material 3 grades: a semester selector, segmented buttons, a summary card,
// course list items with the grade colour badge, a dropdown to predict a
// grade, and modal bottom sheets for semesters and course details.
export default function GradesContent(p: GradesContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const selectedTerm = p.terms.find((item) => item.id === p.termId);
  const simulator = p.mode === "simulator";
  const shown = simulator ? p.projected : p.average;
  const course = p.termCourses.find((item) => item.id === p.detail);
  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: c.bg }}>
      {p.header}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
          gap: 12,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
        refreshControl={
          <RefreshControl
            refreshing={p.refreshing}
            onRefresh={p.refresh}
            colors={[c.primary]}
            progressBackgroundColor={c.surface}
          />
        }
      >
        {p.terms.length ? (
          <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 4 }}
              modifiers={[fillMaxWidth()]}
            >
              <IconButton
                enabled={!!p.previous}
                onClick={() => p.previous && p.chooseTerm(p.previous.id)}
              >
                <Icon
                  source={symbol("chevronLeft")}
                  contentDescription={t(
                    "Poprzedni semestr",
                    "Previous semester",
                  )}
                />
              </IconButton>
              <OutlinedButton
                onClick={() => p.setSheet("semesters")}
                modifiers={[weight(1)]}
              >
                <Text maxLines={1} overflow="ellipsis">
                  {selectedTerm ? termLabel(selectedTerm.name, t) : ""}
                </Text>
                <Icon source={symbol("dropDown")} size={18} />
              </OutlinedButton>
              <IconButton
                enabled={p.termIndex > 0}
                onClick={() =>
                  p.termIndex > 0 && p.chooseTerm(p.terms[p.termIndex - 1].id)
                }
              >
                <Icon
                  source={symbol("chevronRight")}
                  contentDescription={t("Następny semestr", "Next semester")}
                />
              </IconButton>
            </Row>
          </M3Host>
        ) : null}
        <GradesPicker
          label={t("Widok ocen", "Grades view")}
          value={p.mode}
          options={[
            { value: "grades", label: t("Oceny", "Grades") },
            { value: "simulator", label: t("Symulator", "Simulator") },
          ]}
          onChange={p.setMode}
        />
        {p.error ? <ErrorState error={p.error} retry={p.refresh} /> : null}
        <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
          <Card
            colors={{ containerColor: c.surface }}
            modifiers={[fillMaxWidth()]}
          >
            <Column
              verticalArrangement={{ spacedBy: 4 }}
              modifiers={[fillMaxWidth(), paddingAll(20)]}
            >
              <Text color={c.muted} style={{ typography: "labelLarge" }}>
                {simulator
                  ? t("Prognozowana średnia", "Projected average")
                  : t("Średnia ważona", "Weighted average")}
              </Text>
              <Text
                color={gradeTone(shown, c, dark).fg}
                style={{ typography: "displayMedium", fontWeight: "500" }}
              >
                {p.fmt(shown, 3)}
              </Text>
              <Text color={c.muted} style={{ typography: "bodyMedium" }}>
                {simulator
                  ? `USOS ${p.fmt(p.average, 3)} · ${p.difference != null ? p.signed(p.difference) : "—"}`
                  : p.average != null && p.previousAverage != null && p.previous
                    ? `${p.signed(p.average - p.previousAverage)} · ${t("względem", "vs")} ${termLabel(p.previous.name, t)}`
                    : selectedTerm
                      ? termLabel(selectedTerm.name, t)
                      : ""}
              </Text>
              <HorizontalDivider
                color={c.border}
                modifiers={[padding(0, 12, 0, 12)]}
              />
              {simulator ? (
                <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                  <Text
                    color={c.muted}
                    style={{ typography: "bodyMedium" }}
                    modifiers={[weight(1)]}
                  >
                    {t(
                      `Zmienione oceny: ${p.changedCount}`,
                      `Changed grades: ${p.changedCount}`,
                    )}
                  </Text>
                  <TextButton
                    enabled={p.changedCount > 0}
                    onClick={p.resetPredictions}
                  >
                    <Icon source={symbol("restart")} size={18} />
                    <Text modifiers={[padding(8, 0, 0, 0)]}>
                      {t("Resetuj", "Reset")}
                    </Text>
                  </TextButton>
                </Row>
              ) : (
                <Row modifiers={[fillMaxWidth()]}>
                  <Column modifiers={[weight(1)]}>
                    <Text style={{ typography: "titleLarge" }}>
                      {`${p.termCourses.filter((item) => item.passed).length} / ${p.termCourses.length}`}
                    </Text>
                    <Text color={c.muted} style={{ typography: "bodyMedium" }}>
                      {t("Zaliczone przedmioty", "Courses passed")}
                    </Text>
                  </Column>
                  <Column modifiers={[weight(1)]}>
                    <Text style={{ typography: "titleLarge" }}>
                      {`${p.fmt(earnedEcts(p.termCourses), 1)} / ${p.fmt(totalEcts(p.termCourses), 1)}`}
                    </Text>
                    <Text color={c.muted} style={{ typography: "bodyMedium" }}>
                      {t("Zdobyte ECTS", "ECTS earned")}
                    </Text>
                  </Column>
                </Row>
              )}
            </Column>
          </Card>
        </M3Host>
        {p.terms.length > 1 && !simulator ? (
          <View
            style={{
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: c.surface,
            }}
          >
            <M3Host
              matchContents={{ vertical: true }}
              style={{ width: "100%" }}
            >
              <ListItem
                colors={{
                  containerColor: c.surface,
                  contentColor: c.text,
                  supportingContentColor: c.muted,
                }}
                modifiers={[clickable(() => p.setSheet("combined"))]}
              >
                <ListItem.HeadlineContent>
                  <Text style={{ typography: "titleMedium" }}>
                    {t("Wszystkie semestry", "All Semesters")}
                  </Text>
                </ListItem.HeadlineContent>
                <ListItem.SupportingContent>
                  <Text style={{ typography: "bodyMedium" }}>
                    {t(
                      "Porównaj semestry i policz wspólną średnią",
                      "Compare semesters and combine averages",
                    )}
                  </Text>
                </ListItem.SupportingContent>
                <ListItem.TrailingContent>
                  <Icon source={symbol("chevronRight")} tint={c.muted} />
                </ListItem.TrailingContent>
              </ListItem>
            </M3Host>
            <View
              pointerEvents="none"
              style={{ paddingHorizontal: 16, paddingBottom: 16 }}
            >
              <Sparkline
                values={[...p.terms]
                  .reverse()
                  .map((item) => p.termAverage(item.id))}
              />
            </View>
          </View>
        ) : null}
        {simulator ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <RNText style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
              {t(
                "Wybierz ocenę i od razu zobacz wynik. Symulacja nie zmienia ocen w USOS.",
                "Choose a grade to see its impact immediately. Your USOS grades stay unchanged.",
              )}
            </RNText>
          </View>
        ) : (
          <CollectionHeading trailing={p.termCourses.length}>
            {t("Przedmioty", "Courses")}
          </CollectionHeading>
        )}
        {!p.termCourses.length ? (
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
          <View style={{ gap: 2 }}>
            {p.termCourses.map((item, index) => (
              <View
                key={item.id}
                style={{
                  ...segmentRadius(index, p.termCourses.length),
                  overflow: "hidden",
                  backgroundColor: c.surface,
                }}
              >
                <CourseRow {...p} course={item} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      {course ? (
        <GradeDetails course={course} onClose={() => p.setDetail(null)} />
      ) : null}
      {p.sheet ? (
        <GradeSheet
          title={
            p.sheet === "semesters"
              ? t("Wybierz semestr", "Choose Semester")
              : t("Wszystkie semestry", "All Semesters")
          }
          onClose={() => p.setSheet(null)}
        >
          {p.sheet === "combined" ? <Combined {...p} /> : null}
          <View style={{ gap: 2 }}>
            {p.terms.map((item, index) => (
              <View
                key={item.id}
                style={{
                  ...segmentRadius(index, p.terms.length),
                  overflow: "hidden",
                }}
              >
                <SemesterRow
                  {...p}
                  id={item.id}
                  title={termLabel(item.name, t)}
                  current={item.is_current}
                />
              </View>
            ))}
          </View>
        </GradeSheet>
      ) : null}
    </View>
  );
}

const badgeShape = Shape.RoundedCorner({
  cornerRadii: { topStart: 8, topEnd: 8, bottomStart: 8, bottomEnd: 8 },
});

function Badge({ value, label }: { value: number | null; label: string }) {
  const c = useTheme();
  const tone = gradeTone(value, c, useColorScheme() === "dark");
  return (
    <Surface color={tone.soft} shape={badgeShape}>
      <Text
        color={tone.fg}
        style={{ typography: "titleMedium", fontWeight: "700" }}
        modifiers={[padding(12, 4, 12, 4)]}
      >
        {label}
      </Text>
    </Surface>
  );
}

function CourseRow({
  course: item,
  mode,
  overrides,
  choices,
  setGrade,
  setDetail,
  fmt,
}: GradesContentProps & { course: TermCourse }) {
  const c = useTheme();
  const { t } = useLocale();
  const dark = useColorScheme() === "dark";
  const [open, setOpen] = useState(false);
  const simulator = mode === "simulator";
  const prediction = simulator ? overrides[item.id] : undefined;
  const tone = gradeTone(prediction ?? item.mainValue, c, dark);
  const original =
    item.mainValue == null
      ? item.hero
        ? gradeSymbol(item.hero.symbol, t)
        : "—"
      : fmt(item.mainValue, 1);
  const shown = prediction == null ? original : fmt(prediction, 1);
  const status = simulator
    ? prediction == null
      ? "USOS"
      : `${t("Prognoza", "Prediction")} · USOS ${original}`
    : item.passed
      ? t("Zaliczony", "Passed")
      : item.mainValue != null && item.mainValue < 3
        ? t("Niezaliczony", "Not passed")
        : t("W toku", "In progress");
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <ListItem
        colors={{
          containerColor: c.surface,
          contentColor: c.text,
          supportingContentColor: c.muted,
        }}
        modifiers={[clickable(() => setDetail(item.id))]}
      >
        <ListItem.HeadlineContent>
          <Text style={{ typography: "bodyLarge" }}>{item.name}</Text>
        </ListItem.HeadlineContent>
        <ListItem.SupportingContent>
          <Text style={{ typography: "bodyMedium" }}>
            {`${fmt(item.ects, 1)} ECTS · ${status}`}
          </Text>
        </ListItem.SupportingContent>
        <ListItem.TrailingContent>
          {simulator ? (
            <DropdownMenu
              expanded={open}
              onDismissRequest={() => setOpen(false)}
            >
              <DropdownMenu.Trigger>
                <Surface
                  onClick={() => setOpen(true)}
                  color={tone.soft}
                  shape={badgeShape}
                >
                  <Row
                    verticalAlignment="center"
                    modifiers={[padding(12, 4, 4, 4)]}
                  >
                    <Text
                      color={tone.fg}
                      style={{ typography: "titleMedium", fontWeight: "700" }}
                    >
                      {shown}
                    </Text>
                    <Icon source={symbol("dropDown")} tint={c.muted} />
                  </Row>
                </Surface>
              </DropdownMenu.Trigger>
              <DropdownMenu.Items>
                {choices.map((value) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => {
                      setOpen(false);
                      setGrade(item.id, value);
                    }}
                  >
                    <DropdownMenuItem.Text>
                      <Text>{fmt(value, 1)}</Text>
                    </DropdownMenuItem.Text>
                    {(prediction ?? item.mainValue) === value ? (
                      <DropdownMenuItem.TrailingIcon>
                        <Icon source={symbol("check")} />
                      </DropdownMenuItem.TrailingIcon>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                {prediction != null ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setOpen(false);
                      setGrade(item.id, null);
                    }}
                  >
                    <DropdownMenuItem.Text>
                      <Text>
                        {t("Przywróć ocenę z USOS", "Restore USOS Grade")}
                      </Text>
                    </DropdownMenuItem.Text>
                    <DropdownMenuItem.LeadingIcon>
                      <Icon source={symbol("restart")} />
                    </DropdownMenuItem.LeadingIcon>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenu.Items>
            </DropdownMenu>
          ) : (
            <Badge value={item.mainValue} label={shown} />
          )}
        </ListItem.TrailingContent>
      </ListItem>
    </M3Host>
  );
}

function Combined(p: GradesContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const dark = useColorScheme() === "dark";
  const all = p.selectedTerms.length === p.terms.length;
  return (
    <>
      <View style={{ gap: 4, paddingHorizontal: 8 }}>
        <RNText style={{ color: c.muted, fontSize: 14 }}>
          {t("Średnia ważona", "Weighted average")}
        </RNText>
        <RNText
          testID="combined-average"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            color: gradeTone(p.combinedAverage, c, dark).fg,
            fontSize: 45,
            lineHeight: 52,
            fontWeight: "500",
            fontVariant: ["tabular-nums"],
          }}
        >
          {p.fmt(p.combinedAverage, 3)}
        </RNText>
        <RNText style={{ color: c.muted, fontSize: 14 }}>
          {t(
            `Wybrane semestry: ${p.selectedTerms.length}`,
            `Selected semesters: ${p.selectedTerms.length}`,
          )}{" "}
          · {p.fmt(p.combinedEcts, 1)} ECTS
        </RNText>
      </View>
      <View
        style={{
          paddingVertical: 16,
          borderRadius: 12,
          backgroundColor: c.surface,
        }}
      >
        <SemesterChart
          points={[...p.terms].reverse().map((item) => ({
            id: item.id,
            label: termLabel(item.name, t),
            average: p.termAverage(item.id),
            selected: p.selectedTerms.includes(item.id),
          }))}
          format={(value) => p.fmt(value)}
          onToggle={p.toggleTerm}
          combined={p.overallAverage}
        />
      </View>
      <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Text
            color={c.muted}
            style={{ typography: "bodyMedium" }}
            modifiers={[weight(1), padding(8, 0, 8, 0)]}
          >
            {t(
              "Każda ocena jest ważona punktami ECTS.",
              "Each grade is weighted by its ECTS credits.",
            )}
          </Text>
          <TextButton
            onClick={() =>
              p.setSelection(all ? [] : p.terms.map((item) => item.id))
            }
          >
            <Text>
              {all
                ? t("Odznacz wszystkie", "Deselect All")
                : t("Zaznacz wszystkie", "Select All")}
            </Text>
          </TextButton>
        </Row>
      </M3Host>
    </>
  );
}

function SemesterRow({
  id,
  title,
  current,
  sheet,
  selectedTerms,
  termId,
  chooseTerm,
  toggleTerm,
  termAverage,
  fmt,
}: GradesContentProps & { id: string; title: string; current: boolean }) {
  const c = useTheme();
  const { t } = useLocale();
  const dark = useColorScheme() === "dark";
  const checked =
    sheet === "combined" ? selectedTerms.includes(id) : id === termId;
  const value = termAverage(id);
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <ListItem
        colors={{
          containerColor: c.surface,
          contentColor: c.text,
          supportingContentColor: c.muted,
        }}
        modifiers={[
          clickable(() =>
            sheet === "semesters" ? chooseTerm(id) : toggleTerm(id),
          ),
        ]}
      >
        <ListItem.HeadlineContent>
          <Text style={{ typography: "bodyLarge" }}>{title}</Text>
        </ListItem.HeadlineContent>
        {current ? (
          <ListItem.SupportingContent>
            <Text style={{ typography: "bodyMedium" }}>
              {t("Bieżący semestr", "Current semester")}
            </Text>
          </ListItem.SupportingContent>
        ) : null}
        <ListItem.LeadingContent>
          <Icon
            source={symbol("check")}
            tint={checked ? c.primary : "transparent"}
          />
        </ListItem.LeadingContent>
        <ListItem.TrailingContent>
          <Text
            color={gradeTone(value, c, dark).fg}
            style={{ typography: "titleMedium", fontWeight: "600" }}
          >
            {fmt(value)}
          </Text>
        </ListItem.TrailingContent>
      </ListItem>
    </M3Host>
  );
}
