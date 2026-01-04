import { AlertCircleIcon, NotebookPenIcon } from "lucide-react";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { Link } from "react-router";

import { AppContext } from "@/app-context.ts";
import { CourseTypeBadge } from "@/components/course-type-badge";
import { Loader } from "@/components/loader.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import type { Course, Term } from "@/types/user.ts";

export function GradesPage(): React.JSX.Element {
  const appContext = useContext(AppContext);

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedGrades, setEditedGrades] = useState<
    Record<string, number | string>
  >({});

  document.title = "Oceny - Testownik Solvro";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await appContext.services.user.getGrades();
        setTerms(data.terms);
        setCourses(data.courses);
        setSelectedTerm(
          data.terms.find(
            (term) =>
              new Date() >= new Date(term.start_date) &&
              new Date() <= new Date(term.finish_date),
          )?.id ??
            data.terms.toSorted(
              (a, b) =>
                new Date(b.start_date).getTime() -
                new Date(a.start_date).getTime(),
            )[0].id,
        );
        setError(null);
      } catch (fetchError) {
        console.error("Error fetching grades:", fetchError);

        if (fetchError instanceof Error) {
          setError(fetchError.message);
        } else {
          setError("Wystąpił błąd podczas pobierania ocen.");
        }
      } finally {
        setLoading(false);
      }
    };
    if (!appContext.isGuest) {
      void fetchData();
    }
  }, [appContext.services.user, appContext.isGuest]);

  const calculateAverage = useCallback(
    (filteredCourses: Course[]) => {
      const sum = filteredCourses.reduce((accumulator, course) => {
        const courseSum =
          course.grades.reduce((courseAccumulator, grade) => {
            const gradeValue = editedGrades[course.course_id] ?? grade.value;
            if (typeof gradeValue === "string") {
              return courseAccumulator;
            }
            return (
              courseAccumulator +
              (grade.counts_into_average ? gradeValue * course.ects : 0)
            );
          }, 0) +
          (editing &&
          typeof editedGrades[course.course_id] === "number" &&
          course.grades.length === 0
            ? (editedGrades[course.course_id] as number) * course.ects
            : 0);
        return accumulator + courseSum;
      }, 0);

      const totalWeight = filteredCourses.reduce((accumulator, course) => {
        const courseWeight =
          course.grades.reduce(
            (courseAccumulator, grade) =>
              courseAccumulator + (grade.counts_into_average ? course.ects : 0),
            0,
          ) +
          (editing &&
          typeof editedGrades[course.course_id] === "number" &&
          course.grades.length === 0
            ? course.ects
            : 0);
        return accumulator + courseWeight;
      }, 0);

      if (totalWeight === 0) {
        return "-";
      }

      return (sum / totalWeight).toFixed(2);
    },
    [editedGrades, editing],
  );

  const filteredCourses = selectedTerm
    ? courses.filter((course) => course.term_id === selectedTerm)
    : courses;

  if (appContext.isGuest) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Oceny</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm">
          <p>
            Ta funkcja korzysta z Twoich danych z USOSa, więc nie jest dostępna
            w trybie gościa.
          </p>
          <Link to="/connect-account">
            <Button>Połącz konto</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (error != null) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Wystąpił błąd podczas pobierania ocen.</AlertTitle>
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.reload();
            }}
          >
            Spróbuj ponownie
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <CardTitle>Oceny</CardTitle>
              <CardDescription>
                Dzięki tej zakładce możesz szybko policzyć swoją średnią ważoną
                według ECTS
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 pb-8 text-center">
            <p>Ładowanie ocen...</p>
            <Loader size={15} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <CardTitle>Oceny</CardTitle>
            <CardDescription>
              Dzięki tej zakładce możesz szybko policzyć swoją średnią ważoną
              według ECTS
            </CardDescription>
          </div>
          <div>
            <Label htmlFor="term-select" className="sr-only">
              Semestr
            </Label>
            <Select
              value={selectedTerm}
              onValueChange={(value) => {
                setSelectedTerm(value);
                setEditing(false);
                setEditedGrades({});
              }}
              disabled={terms.length === 0}
            >
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Przedmiot</TableHead>
                <TableHead className="font-semibold">ECTS</TableHead>
                <TableHead className="font-semibold">Ocena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.map((course) => {
                const passState = course.passing_status;
                return (
                  <TableRow key={course.course_id} className="h-12">
                    <TableCell className="font-medium break-words whitespace-normal">
                      {course.course_name}{" "}
                      <CourseTypeBadge courseId={course.course_id} />
                    </TableCell>
                    <TableCell>{course.ects}</TableCell>
                    <TableCell
                      className={cn(
                        "w-20",
                        passState === "passed"
                          ? "text-green-600 dark:text-green-400"
                          : passState === "failed"
                            ? "text-destructive"
                            : "",
                      )}
                    >
                      {editing ? (
                        <Input
                          type="number"
                          step={0.5}
                          min={2}
                          max={5.5}
                          className="h-7 w-16"
                          value={
                            editedGrades[course.course_id] ??
                            course.grades.map((g) => g.value).join("; ")
                          }
                          onChange={(event) => {
                            setEditedGrades((previous) => ({
                              ...previous,
                              [course.course_id]:
                                Number.parseFloat(event.target.value) ||
                                event.target.value,
                            }));
                          }}
                        />
                      ) : (
                        <span>
                          {course.grades
                            .map((g) => g.value_symbol)
                            .join("; ") || "-"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Średnia</TableCell>
                <TableCell></TableCell>
                <TableCell id="average" className="font-semibold">
                  {calculateAverage(filteredCourses) || "-"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                className={
                  editing
                    ? "bg-yellow-500 text-white hover:bg-yellow-600 hover:text-white dark:bg-yellow-600 dark:hover:bg-yellow-700"
                    : ""
                }
                pressed={editing}
                onPressedChange={(pressed) => {
                  setEditing(pressed);
                  if (!pressed) {
                    setEditedGrades({});
                  }
                }}
              >
                <span>Tryb edycji</span>
                <NotebookPenIcon />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              {editing
                ? "Tryb edycji (oceny nie są zapisywane, służy do podglądu średniej)"
                : "Włącz tryb edycji, aby sprawdzić średnią z wybranymi ocenami"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
