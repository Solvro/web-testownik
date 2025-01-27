import {Question} from "../types.ts";

/**
 * Validates the quiz data before submission.
 * @param title The title of the quiz.
 * @param questions The list of quiz questions.
 * @returns An error message if validation fails, otherwise null.
 */
export const validateQuiz = (title: string, questions: Question[]): string | null => {
    if (!title.trim()) {
        return 'Podaj tytuł bazy.';
    }

    if (questions.length === 0) {
        return 'Dodaj przynajmniej jedno pytanie.';
    }

    for (const question of questions) {
        if (!question.question.trim()) {
            return 'Wszystkie pytania muszą mieć treść.';
        }

        if (question.answers.length < 1) {
            return 'Wszystkie pytania muszą mieć przynajmniej jedną odpowiedź.';
        }

        if (question.answers.filter((a) => a.correct).length === 0) {
            return 'Wszystkie pytania muszą mieć przynajmniej jedną prawidłową odpowiedź.';
        }

        if (question.answers.some((a) => !a.answer.trim())) {
            return 'Wszystkie odpowiedzi muszą mieć treść.';
        }
    }

    return null; // No validation errors
};