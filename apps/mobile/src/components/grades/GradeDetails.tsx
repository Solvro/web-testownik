import type { CourseView } from "@testownik/core/grades/utils";
import { Text, useColorScheme, View } from "react-native";
import { gradeSymbol, gradeTone } from "../../lib/grades-ui";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { Label } from "../ui";
import GradeSheet from "./GradeSheet";

export default function GradeDetails({
  course,
  onClose,
}: {
  course: CourseView;
  onClose: () => void;
}) {
  const c = useTheme(),
    { t, language } = useLocale(),
    dark = useColorScheme() === "dark";
  const fmt = (n: number) =>
    n.toLocaleString(language, { maximumFractionDigits: 2 });
  const reports = [...(course.hero ? [course.hero] : []), ...course.subs];
  return (
    <GradeSheet title={t("Szczegóły oceny", "Grade Details")} onClose={onClose}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: "700" }}>
          {course.name}
        </Text>
        <Label muted>
          {course.code} · {fmt(course.ects)} ECTS
        </Label>
        <Label muted>
          {course.counts
            ? t("Wliczana do średniej", "Counts towards the average")
            : t(
                "Niewliczana do średniej",
                "Does not count towards the average",
              )}
        </Label>
      </View>
      {reports.length === 0 ? (
        <Label muted>
          {t(
            "USOS nie opublikował jeszcze ocen z tego przedmiotu.",
            "USOS has not published grades for this course yet.",
          )}
        </Label>
      ) : null}
      {reports.map((report) => (
        <View
          key={report.key}
          style={{
            backgroundColor: c.surface,
            borderRadius: 16,
            padding: 18,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text
              style={{
                flex: 1,
                color: c.text,
                fontSize: 17,
                fontWeight: "600",
              }}
            >
              {report.typeLabel}
            </Text>
            <Text
              style={{
                color: gradeTone(report.value, c, dark).fg,
                fontSize: 28,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {report.value == null
                ? gradeSymbol(report.symbol, t)
                : report.value.toLocaleString(language, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
            </Text>
          </View>
          {report.issuer ? <Label>{report.issuer}</Label> : null}
          {report.timestamp ? (
            <Label muted>
              {new Date(report.timestamp.replace(" ", "T")).toString() ===
              "Invalid Date"
                ? report.timestamp
                : new Date(report.timestamp.replace(" ", "T")).toLocaleString(
                    language === "pl" ? "pl-PL" : "en-GB",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}
            </Label>
          ) : null}
          {report.groupAverage != null ? (
            <Label muted>
              {t("Średnia grupy", "Group average")}: {fmt(report.groupAverage)}
            </Label>
          ) : null}
          {report.distribution.length ? (
            <View
              style={{
                gap: 10,
                borderTopWidth: 0.5,
                borderColor: c.border,
                paddingTop: 12,
              }}
            >
              <Label muted>{t("Rozkład ocen", "Grade distribution")}</Label>
              {report.distribution.map((bucket) => {
                const value = Number(String(bucket.grade).replace(",", "."));
                const mine =
                  report.value != null && Math.abs(value - report.value) < 0.01;
                return (
                  <View
                    key={bucket.grade}
                    accessible
                    accessibilityLabel={`${bucket.grade}: ${fmt(bucket.percentage)}%`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Text
                      style={{
                        width: 32,
                        color: c.text,
                        fontWeight: mine ? "700" : "400",
                      }}
                    >
                      {bucket.grade}
                    </Text>
                    <View
                      style={{
                        flex: 1,
                        height: 8,
                        backgroundColor: c.border,
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.min(100, Math.max(0, bucket.percentage))}%`,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: Number.isFinite(value)
                            ? gradeTone(value, c, dark).fg
                            : c.primary,
                          opacity: mine || report.value == null ? 1 : 0.55,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        minWidth: 56,
                        textAlign: "right",
                        color: c.muted,
                      }}
                    >
                      {fmt(bucket.percentage)}%
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ))}
    </GradeSheet>
  );
}
