import type {
  Course,
  CourseClassType,
  Grade,
  GradeIssuer,
  GradeReport,
} from "@/types/user";

// Grade values offered by the average simulator (standard Wrocław scale).
export const SIMULATOR_GRADES = [2, 3, 3.5, 4, 4.5, 5];

export interface GradeColor {
  fg: string;
  soft: string;
}

export function gradeColor(value: number | null): GradeColor {
  if (value == null) {
    return {
      fg: "var(--muted-foreground)",
      soft: "color-mix(in oklab, var(--muted-foreground) 16%, transparent)",
    };
  }
  if (value >= 4.75) {
    return { fg: "#10b981", soft: "rgba(16,185,129,.15)" };
  }
  if (value >= 4.25) {
    return { fg: "#22c55e", soft: "rgba(34,197,94,.15)" };
  }
  if (value >= 3.75) {
    return { fg: "#84cc16", soft: "rgba(132,204,22,.17)" };
  }
  if (value >= 3.25) {
    return { fg: "#eab308", soft: "rgba(234,179,8,.17)" };
  }
  if (value >= 2.75) {
    return { fg: "#f97316", soft: "rgba(249,115,22,.17)" };
  }
  return { fg: "#ef4444", soft: "rgba(239,68,68,.17)" };
}

export function fmtNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtSigned(value: number, digits = 2) {
  const sign = value >= 0 ? "+" : "−";
  return (
    sign +
    Math.abs(value).toLocaleString("pl-PL", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function numericGradeValue(value: string | null | undefined) {
  if (value == null) {
    return null;
  }
  const normalized = value.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const numericValue = Number.parseFloat(normalized);
  return Number.isNaN(numericValue) ? null : numericValue;
}

export function numericGradeLabel(value: string) {
  const numericValue = numericGradeValue(value);
  if (numericValue == null) {
    return value;
  }
  return numericValue.toLocaleString("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: numericValue % 1 === 0 ? 0 : 1,
  });
}

function gradeLabel(grade: Grade) {
  return grade.value_symbol ?? grade.value?.toLocaleString("pl-PL") ?? "-";
}

function parseGradeDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value.replace(" ", "T");
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatGradeDate(value: string) {
  const date = parseGradeDate(value);

  if (date == null) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function gradeTimestamp(grade: Grade | null) {
  if (grade?.date_modified != null) {
    return grade.date_modified;
  }

  return null;
}

function isNewGrade(timestamp: string | null) {
  if (timestamp == null) {
    return false;
  }

  const date = parseGradeDate(timestamp);
  if (date == null) {
    return false;
  }

  const age = Date.now() - date.getTime();
  return age >= 0 && age <= 24 * 60 * 60 * 1000;
}

function classTypeLabel(classType: CourseClassType | null | undefined) {
  if (classType == null) {
    return null;
  }
  return classType.name_pl ?? classType.name_en ?? classType.id;
}

function localizedName(
  value: string | Record<string, string | null> | null | undefined,
) {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.pl ?? value.en ?? null;
}

function issuerLabel(issuer: GradeIssuer | null | undefined) {
  if (issuer == null) {
    return null;
  }
  const fullName = localizedName(issuer.name);
  if (fullName != null && fullName.length > 0) {
    return fullName;
  }
  const composedName =
    `${issuer.first_name ?? ""} ${issuer.last_name ?? ""}`.trim();
  if (composedName.length > 0) {
    return composedName;
  }
  return issuer.id == null ? null : `ID ${String(issuer.id)}`;
}

export interface DistributionEntry {
  grade: string;
  percentage: number;
}

function buildDistribution(report: GradeReport): DistributionEntry[] {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const item of report.grades_distribution) {
    if (
      item.grade_symbol == null ||
      item.percentage == null ||
      numericGradeValue(item.grade_symbol) == null
    ) {
      continue;
    }
    const grade = numericGradeLabel(item.grade_symbol);
    const bucket = buckets.get(grade) ?? { total: 0, count: 0 };
    bucket.total += item.percentage;
    bucket.count += 1;
    buckets.set(grade, bucket);
  }
  return [...buckets.entries()]
    .map(([grade, bucket]) => ({
      grade,
      percentage: bucket.total / bucket.count,
    }))
    .toSorted((a, b) => {
      const left = numericGradeValue(a.grade) ?? 0;
      const right = numericGradeValue(b.grade) ?? 0;
      return left - right;
    });
}

function distributionAverage(distribution: DistributionEntry[]) {
  const totals = distribution.reduce(
    (accumulator, item) => {
      const value = numericGradeValue(item.grade);
      if (value == null) {
        return accumulator;
      }
      return {
        weighted: accumulator.weighted + value * item.percentage,
        percentage: accumulator.percentage + item.percentage,
      };
    },
    { weighted: 0, percentage: 0 },
  );
  return totals.percentage === 0 ? null : totals.weighted / totals.percentage;
}

export interface ReportView {
  key: string;
  value: number | null;
  symbol: string;
  color: GradeColor;
  counts: boolean;
  scope: string;
  typeLabel: string;
  reportType: string;
  issuer: string | null;
  timestamp: string | null;
  isNew: boolean;
  groupAverage: number | null;
  groupDelta: number | null;
  distribution: DistributionEntry[];
}

export interface CourseView {
  id: string;
  name: string;
  code: string;
  courseTypeNames: string[];
  courseTypeSymbols: string[];
  ects: number;
  passed: boolean;
  hero: ReportView | null;
  subs: ReportView[];
  mainValue: number | null;
  counts: boolean;
  color: GradeColor;
}

function pickReportGrade(report: GradeReport): Grade | null {
  const withValue = report.grades.filter(
    (grade) => grade.value != null || grade.value_symbol != null,
  );
  if (withValue.length === 0) {
    return null;
  }
  return withValue.find((grade) => grade.counts_into_average) ?? withValue[0];
}

function buildReportView(report: GradeReport, key: string): ReportView {
  const grade = pickReportGrade(report);
  const value =
    grade == null
      ? null
      : (grade.value ?? numericGradeValue(grade.value_symbol));
  const distribution = buildDistribution(report);
  const groupAverage = distributionAverage(distribution);
  const groupDelta =
    value != null && groupAverage != null ? value - groupAverage : null;
  const classLabel = classTypeLabel(report.class_type);
  const typeLabel =
    report.class_type_id == null
      ? (report.type_description ?? report.type_id ?? "Zaliczenie")
      : (classLabel ?? report.class_type_id);
  const timestamp = gradeTimestamp(grade);
  return {
    key,
    value,
    symbol: grade == null ? "–" : gradeLabel(grade),
    color: gradeColor(value),
    counts: grade?.counts_into_average ?? false,
    scope: report.scope,
    typeLabel,
    reportType: report.type_description ?? report.type_id ?? "Zaliczenie",
    issuer: grade == null ? null : issuerLabel(grade.modification_author),
    timestamp,
    isNew: isNewGrade(timestamp),
    groupAverage,
    groupDelta,
    distribution,
  };
}

function directGradeView(grade: Grade, code: string): ReportView {
  const value = grade.value ?? numericGradeValue(grade.value_symbol);
  const timestamp = gradeTimestamp(grade);
  return {
    key: `${code}-direct`,
    value,
    symbol: gradeLabel(grade),
    color: gradeColor(value),
    counts: grade.counts_into_average,
    scope: "course",
    typeLabel: "Ocena końcowa",
    reportType: "Ocena końcowa",
    issuer: issuerLabel(grade.modification_author),
    timestamp,
    isNew: isNewGrade(timestamp),
    groupAverage: null,
    groupDelta: null,
    distribution: [],
  };
}

export function buildCourseView(course: Course): CourseView {
  const reports = course.reports ?? [];
  const reportViews = reports.map((report, index) =>
    buildReportView(
      report,
      `${course.course_id}-${String(report.id ?? index)}-${report.scope}`,
    ),
  );

  let hero: ReportView | null =
    reportViews.find((view) => view.scope === "course" && view.counts) ??
    reportViews.find((view) => view.scope === "course") ??
    (reportViews.length > 0 ? reportViews[0] : null);

  if (hero == null) {
    const direct = (course.grades ?? []).filter(
      (grade) => grade.value != null || grade.value_symbol != null,
    );
    const chosen =
      direct.find((grade) => grade.counts_into_average) ??
      (direct.length > 0 ? direct[0] : null);
    if (chosen != null) {
      hero = directGradeView(chosen, course.course_id);
    }
  }

  const subs = reportViews.filter((view) => view !== hero);
  const mainValue = hero?.value ?? course.weighted_average ?? null;
  const classTypes = course.class_types ?? [];

  return {
    id: course.course_id,
    name: course.course_name,
    code: course.course_id,
    courseTypeNames: classTypes
      .map((classType) => classTypeLabel(classType))
      .filter((label): label is string => label != null && label.length > 0),
    courseTypeSymbols: classTypes
      .map((classType) => classType.id)
      .filter((label) => label.length > 0),
    ects: course.ects,
    passed: course.passing_status === "passed",
    hero,
    subs,
    mainValue,
    counts: hero?.counts ?? false,
    color: gradeColor(mainValue),
  };
}

export function weightedAverage(courses: CourseView[]) {
  let sum = 0;
  let weight = 0;
  for (const course of courses) {
    if (course.mainValue != null && course.counts) {
      sum += course.mainValue * course.ects;
      weight += course.ects;
    }
  }
  return weight === 0 ? null : sum / weight;
}

export function totalEcts(courses: CourseView[]) {
  return courses.reduce((accumulator, course) => accumulator + course.ects, 0);
}

export function earnedEcts(courses: CourseView[]) {
  return courses.reduce(
    (accumulator, course) => accumulator + (course.passed ? course.ects : 0),
    0,
  );
}

// Grade options offered by the simulator for a term: the standard scale plus
// any grade that actually appears in the term's data (e.g. 5,5 in older terms).
export function termGradeOptions(courses: CourseView[]) {
  const options = new Set<number>(SIMULATOR_GRADES);
  for (const course of courses) {
    const views =
      course.hero == null ? course.subs : [course.hero, ...course.subs];
    for (const view of views) {
      if (view.value != null) {
        options.add(view.value);
      }
      for (const entry of view.distribution) {
        const value = numericGradeValue(entry.grade);
        if (value != null) {
          options.add(value);
        }
      }
    }
  }
  return [...options]
    .filter((value) => value >= 2 && value <= 5.5)
    .toSorted((a, b) => a - b);
}
