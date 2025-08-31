import React, { useContext, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AppContext from "../../AppContext.tsx";
import { Link } from "react-router";
import Markdown from "marked-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { LoaderCircleIcon } from "lucide-react";

interface Answer {
  answer: string;
  correct: boolean;
}

interface Question {
  id: number;
  question: string;
  quiz_title: string;
  quiz_id: number;
  answers: Answer[];
}

const QuestionQuizCard: React.FC<React.ComponentProps<typeof Card>> = ({
  className,
  ...props
}) => {
  const appContext = useContext(AppContext);
  const [questionData, setQuestionData] = useState<Question | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [enableEdit, setEnableEdit] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchQuestion();
  }, []);

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      if (appContext.isGuest) {
        const guestQuizzes = localStorage.getItem("guest_quizzes")
          ? JSON.parse(localStorage.getItem("guest_quizzes")!)
          : [];
        if (!guestQuizzes.length) {
          setQuestionData(null);
          throw new Error("No questions available");
        }
        const randomQuiz =
          guestQuizzes[Math.floor(Math.random() * guestQuizzes.length)];
        const randomQuestion =
          randomQuiz.questions[
            Math.floor(Math.random() * randomQuiz.questions.length)
          ];
        setQuestionData(randomQuestion);
        setSelectedAnswers([]);
        setEnableEdit(true);
        setResult(null);
        setLoading(false);
        return;
      }
      const response = await appContext.axiosInstance.get("/random-question/");
      if (!response.data) {
        setQuestionData(null);
        throw new Error("No questions available");
      }
      const data: Question = response.data;
      setQuestionData(data);
      setSelectedAnswers([]);
      setEnableEdit(true);
      setResult(null);
    } catch {
      setQuestionData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleAnswer = (index: number) => {
    if (!enableEdit) return;
    setSelectedAnswers((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const checkAnswers = () => {
    if (!questionData) return;

    let isCorrect = true;

    questionData.answers.forEach((answer, idx) => {
      const isSelected = selectedAnswers.includes(idx);
      if ((isSelected && !answer.correct) || (!isSelected && answer.correct)) {
        isCorrect = false;
      }
    });

    setResult(isCorrect ? "Poprawna odpowiedź!" : "Niepoprawna odpowiedź.");
    setEnableEdit(false);
  };

  const computeAnswerVariant = (
    isSelected: boolean,
    isResult: boolean,
    isCorrect: boolean,
  ) => {
    if (isResult) {
      if (isCorrect && isSelected)
        return "border-green-500 bg-green-500/15 text-green-600 dark:text-green-400"; // Correct & chosen
      if (isCorrect && !isSelected)
        return "border-yellow-500 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"; // Missed correct answer
      if (!isCorrect && isSelected)
        return "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400"; // Chosen but incorrect
      return "opacity-50"; // Not selected & incorrect (distractor)
    }
    // Idle (selecting answers) phase
    return isSelected
      ? "bg-primary/10 border-primary"
      : "hover:bg-accent border-border";
  };

  if (!questionData) {
    if (loading) {
      return (
        <Card
          className={cn("max-h-[80vh] md:max-h-none", className)}
          {...props}
        >
          <div className="flex flex-col gap-4">
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Skeleton className="h-9 w-40" />
            </CardFooter>
          </div>
        </Card>
      );
    }
    return (
      <Card className={className} {...props}>
        <CardHeader>
          <CardTitle>Nie masz żadnych pytań do powtórzenia</CardTitle>
          <CardDescription>
            Po użyciu twojego pierwszego quizu pojawią się tutaj pytania.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full opacity-0 transition-opacity hover:opacity-100">
          <iframe
            src="https://pointerpointer.com"
            className="h-full w-full rounded-lg"
          ></iframe>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("max-h-[80vh] gap-2 md:max-h-none", className)}
      {...props}
    >
      <ScrollArea className="min-h-0 w-full">
        <div className="flex flex-col gap-4">
          <CardHeader>
            <small className="text-muted-foreground text-xs">
              Powtórz to jeszcze raz:
            </small>
            <ScrollArea className="w-full min-w-0">
              <CardTitle className="mb-1">
                <Markdown>{questionData.question}</Markdown>
              </CardTitle>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <CardDescription>
              <Link
                to={`/quiz/${questionData.quiz_id}`}
                className="text-muted-foreground hover:text-foreground block text-xs transition-colors"
              >
                {questionData.quiz_title}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {questionData.answers.map((answer, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleAnswer(idx)}
                  disabled={!enableEdit}
                  className={cn(
                    "w-full justify-start rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    computeAnswerVariant(
                      selectedAnswers.includes(idx),
                      !!result,
                      answer.correct,
                    ),
                  )}
                >
                  {answer.answer}
                </button>
              ))}
            </div>
          </CardContent>
        </div>
      </ScrollArea>
      <CardFooter className="flex flex-col items-start gap-2">
        {result && (
          <p
            className={cn(
              "mt-3 text-sm font-medium",
              result.includes("Poprawna")
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {result}
          </p>
        )}
        <div className="flex w-full justify-end">
          {loading ? (
            <Button size="sm" variant="outline" disabled>
              <LoaderCircleIcon className="animate-spin" />
              Ładowanie...
            </Button>
          ) : enableEdit ? (
            <Button size="sm" onClick={checkAnswers}>
              Sprawdź odpowiedź
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={fetchQuestion}>
              Następne pytanie
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default QuestionQuizCard;
