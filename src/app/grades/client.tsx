"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionAction } from "@/lib/auth/permissions";
import { getUserService } from "@/services";
import { ACCOUNT_TYPE } from "@/types/user";
import type { Term } from "@/types/user";

import { AverageSimulator } from "./components/average-simulator";
import {
  buildCourseView,
  earnedEcts,
  termGradeOptions,
  totalEcts,
  weightedAverage,
} from "./components/grade-utils";
import { GradesHeader } from "./components/grades-header";
import { GradesList } from "./components/grades-list";
import { GradesSkeleton } from "./components/grades-skeleton";
import { MultiTermCalculator } from "./components/multi-term-calculator";
import { SummaryStats } from "./components/summary-stats";

function GradesContent() {
  const { checkPermission, user } = useContext(AppContext);

  const {
    data: gradesData,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => getUserService().getGrades(),
    enabled: checkPermission(PermissionAction.VIEW_GRADES),
  });

  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [whatIf, setWhatIf] = useState<Record<string, number>>({});
  const [selectedTerms, setSelectedTerms] = useState<Record<string, boolean>>(
    {},
  );

  const terms = gradesData?.terms ?? [];
  const courses = gradesData?.courses ?? [];
  const orderedTerms = terms.toSorted(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  const currentTermId =
    orderedTerms.find(
      (term) =>
        new Date() >= new Date(term.start_date) &&
        new Date() <= new Date(term.finish_date),
    )?.id ?? orderedTerms.at(-1)?.id;
  if (selectedTerm === "" && currentTermId != null) {
    const currentIndex = orderedTerms.findIndex(
      (term) => term.id === currentTermId,
    );
    const previousId =
      currentIndex > 0 ? orderedTerms.at(currentIndex - 1)?.id : null;
    setSelectedTerm(currentTermId);
    setSelectedTerms({
      [currentTermId]: true,
      ...(previousId == null ? {} : { [previousId]: true }),
    });
  }

  if (!checkPermission(PermissionAction.VIEW_GRADES)) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Oceny</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm">
          <p>
            Ta funkcja korzysta z Twoich danych z USOSa, więc nie jest dostępna
            dla Twojego typu konta.
          </p>
          {user?.account_type === ACCOUNT_TYPE.GUEST && (
            <Link href="/login?redirect=/grades">
              <Button>Zaloguj się</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  if (error != null) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Wystąpił błąd podczas pobierania ocen.</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              window.location.reload();
            }}
          >
            Spróbuj ponownie
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (loading) {
    return <GradesSkeleton />;
  }

  const courseViews = courses.map((course) => buildCourseView(course));
  const coursesByTerm = (termId: string) =>
    courseViews.filter((_, index) => courses[index].term_id === termId);

  const termCourses = coursesByTerm(selectedTerm);

  const realAverage = weightedAverage(termCourses);
  const passedCount = termCourses.filter((course) => course.passed).length;
  const ectsTotal = totalEcts(termCourses);
  const ectsEarned = earnedEcts(termCourses);
  const simulatorGrades = termGradeOptions(termCourses);

  const currentIndex = orderedTerms.findIndex(
    (term) => term.id === selectedTerm,
  );
  const previousTerm: Term | null =
    currentIndex > 0 ? orderedTerms[currentIndex - 1] : null;
  const previousAverage =
    previousTerm == null
      ? null
      : weightedAverage(coursesByTerm(previousTerm.id));
  const averageDelta =
    realAverage != null && previousAverage != null
      ? realAverage - previousAverage
      : null;

  let projectedSum = 0;
  let projectedWeight = 0;
  const overrideOf = (id: string): number | undefined => whatIf[id];
  for (const course of termCourses) {
    const overridden = overrideOf(course.id);
    const current = overridden ?? course.mainValue;
    const counts =
      overridden == null ? course.counts && course.mainValue != null : true;
    if (current != null && counts) {
      projectedSum += current * course.ects;
      projectedWeight += course.ects;
    }
  }
  const projected =
    projectedWeight === 0 ? null : projectedSum / projectedWeight;
  const projectedDelta =
    projected != null && realAverage != null ? projected - realAverage : null;

  const termChips = orderedTerms.toReversed().map((term) => {
    const termCourseViews = coursesByTerm(term.id);
    return {
      id: term.id,
      name: term.name,
      average: weightedAverage(termCourseViews),
      ects: totalEcts(termCourseViews),
      selected: selectedTerms[term.id] ?? false,
    };
  });
  const combinedCourses = courseViews.filter(
    (_, index) => selectedTerms[courses[index].term_id],
  );
  const combinedAverage = weightedAverage(combinedCourses);
  const combinedEcts = totalEcts(combinedCourses);
  const combinedCount = Object.values(selectedTerms).filter(Boolean).length;
  const allTermsSelected =
    termChips.length > 0 && termChips.every((chip) => chip.selected);

  const termOptions = orderedTerms.toReversed().map((term) => ({
    id: term.id,
    name: term.name,
    average: weightedAverage(coursesByTerm(term.id)),
    current: term.id === selectedTerm,
  }));

  return (
    <div className="pb-4">
      <GradesHeader
        termOptions={termOptions}
        disabled={terms.length === 0}
        onSelectTerm={(id) => {
          setSelectedTerm(id);
          setWhatIf({});
          setExpanded({});
        }}
      />

      <div className="mt-3 sm:mt-6">
        <SummaryStats
          average={realAverage}
          averageDelta={averageDelta}
          previousTermName={
            averageDelta == null ? null : (previousTerm?.name ?? null)
          }
          passedCount={passedCount}
          courseCount={termCourses.length}
          ectsEarned={ectsEarned}
          ectsTotal={ectsTotal}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 sm:mt-5 lg:grid-cols-[1.55fr_1fr] lg:gap-5">
        <GradesList
          courses={termCourses}
          expanded={expanded}
          onToggle={(id, open) => {
            setExpanded((previous) => ({ ...previous, [id]: open }));
          }}
        />

        <Tabs defaultValue="simulator" className="gap-3">
          <TabsList className="w-full">
            <TabsTrigger value="simulator">Symulator</TabsTrigger>
            <TabsTrigger value="terms">Wiele semestrów</TabsTrigger>
          </TabsList>
          <TabsContent value="simulator">
            <AverageSimulator
              courses={termCourses}
              grades={simulatorGrades}
              whatIf={whatIf}
              realAverage={realAverage}
              projected={projected}
              projectedDelta={projectedDelta}
              onSetGrade={(courseId, value) => {
                setWhatIf((previous) => {
                  if (value == null) {
                    return Object.fromEntries(
                      Object.entries(previous).filter(
                        ([id]) => id !== courseId,
                      ),
                    );
                  }
                  return { ...previous, [courseId]: value };
                });
              }}
              onReset={() => {
                setWhatIf({});
              }}
            />
          </TabsContent>
          <TabsContent value="terms">
            <MultiTermCalculator
              chips={termChips}
              combinedAverage={combinedAverage}
              combinedEcts={combinedEcts}
              combinedCount={combinedCount}
              allSelected={allTermsSelected}
              onToggleTerm={(id) => {
                setSelectedTerms((previous) => ({
                  ...previous,
                  [id]: !previous[id],
                }));
              }}
              onToggleAll={() => {
                setSelectedTerms(
                  allTermsSelected
                    ? {}
                    : Object.fromEntries(
                        orderedTerms.map((term) => [term.id, true]),
                      ),
                );
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function GradesPageClient() {
  return <GradesContent />;
}
