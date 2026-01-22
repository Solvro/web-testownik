"use client";

import { distance } from "fastest-levenshtein";
import { AlertCircleIcon } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppContext } from "@/app-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Quiz } from "@/types/quiz";

interface SearchInQuizPageClientProps {
  quizId: string;
}

// Function to highlight the matched text
const escapeRegExp = (s: string) =>
  s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const highlightMatch = (text: string, q: string): ReactNode => {
  if (!q) {
    return text;
  }
  try {
    const regex = new RegExp(`(${escapeRegExp(q)})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <span
          key={`highlight-${index.toString()}`}
          className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-400/30"
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
  } catch {
    return text; // Fallback if regex fails
  }
};

function SearchInQuizPageContent({ quizId }: { quizId: string }) {
  const appContext = useContext(AppContext);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (typeof document !== "undefined") {
    document.title = `Wyszukaj w quizach - ${quiz?.title ?? "Ładowanie..."} - Testownik Solvro`;
  }

  useEffect(() => {
    const fetchQuiz = async () => {
      if (quizId.trim() === "") {
        setError("Nieprawidłowy identyfikator quizu.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await appContext.services.quiz.getQuiz(quizId);
        setQuiz(data);
      } catch {
        setError("Wystąpił błąd podczas ładowania quizu.");
      } finally {
        setLoading(false);
      }
    };

    void fetchQuiz();
  }, [quizId, appContext.services.quiz]);

  const filteredQuestions = (() => {
    if (quiz == null || !query.trim()) {
      return quiz?.questions ?? [];
    }

    const lowerCaseQuery = query.toLowerCase().trim();
    const queryWords = lowerCaseQuery
      .split(/\s+/)
      .filter((word) => word.length > 1);
    const typoToleranceThreshold = 3;

    return quiz.questions
      .map((question) => {
        const questionLower = question.text.toLowerCase();
        const questionWords = questionLower
          .split(/\s+/)
          .filter((word) => word.length > 0);
        const questionWordCount = questionWords.length;

        // Check for exact matches first
        const exactMatch = questionLower.includes(lowerCaseQuery);

        // Check for word-level matches
        let wordMatches = 0;
        let bestWordDistance = Infinity;

        if (queryWords.length > 0) {
          // Count how many query words appear in the question
          for (const qWord of queryWords) {
            if (questionWords.some((word) => word.includes(qWord))) {
              wordMatches++;
            }

            // Find closest word match for typo tolerance
            for (const word of questionWords) {
              const wordDistance = distance(word, qWord);
              bestWordDistance = Math.min(bestWordDistance, wordDistance);
            }
          }
        }

        // Check answers for matches
        const answerMatches = question.answers.some((answer) =>
          answer.text.toLowerCase().includes(lowerCaseQuery),
        );

        // Number of answer matches
        const answerMatchCount = question.answers.filter((answer) =>
          answer.text.toLowerCase().includes(lowerCaseQuery),
        ).length;

        // Calculate relevance score - lower is better
        let relevance = exactMatch ? -200 : 0;

        // Boost for word matches
        relevance -= wordMatches * 50;

        // Only use typo tolerance if we have some word matches or exact matches
        if (!exactMatch && wordMatches === 0) {
          relevance = 1000; // High relevance (bad) for no matches
        } else if (!exactMatch && bestWordDistance !== Infinity) {
          relevance += bestWordDistance;
        }

        // Boost for answer matches
        relevance -= answerMatchCount * 30;

        // Calculate match density (ratio of matches to question length)
        const matchDensity =
          questionWordCount > 0 ? wordMatches / questionWordCount : 0;

        // console.log(
        //   `Question: ${question.question}, Relevance: ${relevance}, Word Matches: ${wordMatches}, Exact Match: ${exactMatch}, Match Density: ${matchDensity}`,
        // );

        return {
          ...question,
          relevance,
          matchesAnswer: answerMatches,
          hasExactMatch: exactMatch,
          wordMatchCount: wordMatches,
          questionWordCount,
          matchDensity,
        };
      })
      .filter(
        (question) =>
          question.hasExactMatch || // Always include exact matches
          question.matchesAnswer || // Always include answer matches
          (question.wordMatchCount > 0 && // Only include if we have actual word matches
            (question.relevance <= typoToleranceThreshold || // Good typo tolerance
              question.matchDensity >= 0.3 || // At least 15% of words match
              question.wordMatchCount >= 3)), // Or at least 2 words match
      )
      .toSorted((a, b) => a.relevance - b.relevance);
  })();

  if (loading) {
    return <div className="text-center">Ładowanie...</div>;
  }

  if (error != null) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Wystąpił błąd: </AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{quiz?.title}</h1>
        {quiz?.description != null && (
          <p className="text-muted-foreground max-w-prose text-sm">
            {quiz.description}
          </p>
        )}
      </div>
      <Input
        placeholder="Wyszukaj w pytaniach lub odpowiedziach..."
        value={query}
        onChange={(event_) => {
          setQuery(event_.target.value);
        }}
      />
      {filteredQuestions.length > 0 ? (
        <div className="space-y-3">
          {filteredQuestions.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="space-y-2 text-base font-medium">
                  <div>{highlightMatch(q.text, query)}</div>
                  {q.image != null && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.image}
                      alt={q.text}
                      className="mx-auto block max-w-full rounded"
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {q.answers.map((answer) => (
                    <li
                      key={`answer-${answer.id}`}
                      className={
                        answer.is_correct
                          ? "font-medium text-green-600 dark:text-green-400"
                          : "text-muted-foreground"
                      }
                    >
                      {highlightMatch(answer.text, query)}
                      {answer.image != null && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={answer.image}
                          alt={answer.text}
                          className={`mx-auto mt-1 block max-w-full rounded ${answer.is_correct ? "ring-2 ring-green-500" : ""}`}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Alert variant="default">
          <AlertCircleIcon />
          <AlertTitle>Brak wyników dla podanego zapytania.</AlertTitle>
        </Alert>
      )}
    </div>
  );
}

export function SearchInQuizPageClient({
  quizId,
}: SearchInQuizPageClientProps) {
  return <SearchInQuizPageContent quizId={quizId} />;
}
