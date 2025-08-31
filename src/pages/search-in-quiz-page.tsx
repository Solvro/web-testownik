import { distance } from "fastest-levenshtein";
import { AlertCircleIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import AppContext from "../app-context.tsx";
import type { Question, Quiz } from "../components/quiz/types.ts";

const SearchInQuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const appContext = React.useContext(AppContext);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [query, setQuery] = useState<string>("");
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  document.title = `Wyszukaj w quizach - ${quiz?.title || "Ładowanie..."} - Testownik Solvro`;

  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      try {
        const response = await appContext.axiosInstance.get(
          `/quizzes/${quizId}/`,
        );
        if (response.status === 200) {
          const data: Quiz = response.data;
          setQuiz(data);
          setFilteredQuestions(data.questions);
        } else {
          setError("Nie udało się załadować quizu.");
        }
      } catch {
        setError("Wystąpił błąd podczas ładowania quizu.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, appContext.axiosInstance]);

  useEffect(() => {
    if (!quiz || !query.trim()) {
      setFilteredQuestions(quiz?.questions || []);
      return;
    }

    const lowerCaseQuery = query.toLowerCase().trim();
    const queryWords = lowerCaseQuery
      .split(/\s+/)
      .filter((word) => word.length > 1);
    const typoToleranceThreshold = 3;

    const filtered = quiz.questions
      .map((question) => {
        const questionLower = question.question.toLowerCase();
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
          answer.answer.toLowerCase().includes(lowerCaseQuery),
        );

        // Number of answer matches
        const answerMatchCount = question.answers.filter((answer) =>
          answer.answer.toLowerCase().includes(lowerCaseQuery),
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

        console.log(
          `Question: ${question.question}, Relevance: ${relevance}, Word Matches: ${wordMatches}, Exact Match: ${exactMatch}, Match Density: ${matchDensity}`,
        );
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
      .sort((a, b) => a.relevance - b.relevance);

    setFilteredQuestions(filtered);
  }, [query, quiz]);

  // Function to highlight the matched text
  const escapeRegExp = (s: string) =>
    s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const highlightMatch = (text: string, q: string): React.ReactNode => {
    if (!q) {
      return text;
    }
    try {
      const regex = new RegExp(`(${escapeRegExp(q)})`, "gi");
      const parts = text.split(regex);
      return parts.map((part, index) =>
        regex.test(part) ? (
          <span
            key={index}
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

  if (loading) {
    return <div className="text-center">Ładowanie...</div>;
  }

  if (error) {
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
        {quiz?.description ? (
          <p className="text-muted-foreground max-w-prose text-sm">
            {quiz.description}
          </p>
        ) : null}
      </div>
      <Input
        placeholder="Wyszukaj w pytaniach lub odpowiedziach..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
      />
      {filteredQuestions.length > 0 ? (
        <div className="space-y-3">
          {filteredQuestions.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="space-y-2 text-base font-medium">
                  <div>{highlightMatch(q.question, query)}</div>
                  {q.image ? (
                    <img
                      src={q.image}
                      alt={q.question}
                      className="mx-auto block max-w-full rounded"
                    />
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {q.answers.map((answer, index) => (
                    <li
                      key={index}
                      className={
                        answer.correct
                          ? "font-medium text-green-600 dark:text-green-400"
                          : "text-muted-foreground"
                      }
                    >
                      {highlightMatch(answer.answer, query)}
                      {answer.image ? (
                        <img
                          src={answer.image}
                          alt={answer.answer}
                          className={`mx-auto mt-1 block max-w-full rounded ${answer.correct ? "ring-2 ring-green-500" : ""}`}
                        />
                      ) : null}
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
};

export default SearchInQuizPage;
