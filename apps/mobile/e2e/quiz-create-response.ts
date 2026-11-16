/** Mock the mobile receipt envelope while older guest fixtures keep their raw quiz. */
export function quizCreateResponse(
  body: Record<string, any>,
  saved: Record<string, any>,
) {
  if (!body.request_id) return saved;
  const submitted = body.quiz;
  const quiz = {
    ...submitted,
    ...saved,
    version: saved.version ?? 1,
    questions: saved.questions ?? submitted.questions,
  };
  const questions: Record<string, string> = {},
    answers: Record<string, string> = {};
  submitted.questions.forEach(
    (question: Record<string, any>, index: number) => {
      questions[question.id] = quiz.questions[index].id;
      question.answers.forEach(
        (answer: Record<string, any>, answerIndex: number) => {
          answers[answer.id] = quiz.questions[index].answers[answerIndex].id;
        },
      );
    },
  );
  return {
    request_id: body.request_id,
    status: "created",
    quiz,
    created_version: quiz.version,
    id_map: { questions, answers },
  };
}
