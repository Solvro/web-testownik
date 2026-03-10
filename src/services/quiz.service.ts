import { buildFallbackSession, deriveSettings } from "@/lib/session-utils";
import type { ApiPaginatedResponse } from "@/types/common";
import type { Question } from "@/types/quiz";

import { BaseApiService } from "./base-api.service";
import type {
  AnswerRecord,
  Group,
  QuestionWithQuizInfo,
  Quiz,
  QuizMetadata,
  QuizSession,
  QuizWithUserProgress,
  SharedQuiz,
  User,
} from "./types";

/**
 * Service for handling quiz-related API operations
 */
export class QuizService extends BaseApiService {
  /**
   * Fetch all quizzes for the current user
   */
  async getQuizzes(): Promise<QuizMetadata[]> {
    const response = await this.get<QuizMetadata[]>("quizzes/");
    return response.data;
  }

  /**
   * Fetch a specific quiz by ID
   */
  async getQuiz(quizId: string): Promise<Quiz> {
    const response = await this.get<Quiz>(`quizzes/${quizId}/`);
    return response.data;
  }

  async getQuizWithProgress(quizId: string): Promise<QuizWithUserProgress> {
    const response = await this.get<QuizWithUserProgress>(
      `quizzes/${quizId}/`,
      {
        include: ["user_settings", "current_session"].join(","),
      },
    );

    response.data.current_session ??= buildFallbackSession(
      response.data,
      deriveSettings(response.data.user_settings),
    );

    return response.data;
  }

  /**
   * Create a new quiz
   */
  async createQuiz(quizData: {
    title: string;
    description: string;
    questions: unknown[];
  }): Promise<Quiz> {
    const response = await this.post<Quiz>("quizzes/", quizData);
    return response.data;
  }

  /**
   * Update an existing quiz
   */
  async updateQuiz(quizId: string, quizData: Partial<Quiz>): Promise<Quiz> {
    const response = await this.patch<Quiz>(`quizzes/${quizId}/`, quizData);
    return response.data;
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId: string): Promise<void> {
    await this.delete(`quizzes/${quizId}/`);
  }

  /**
   * Get shared quizzes
   */
  async getSharedQuizzes(): Promise<SharedQuiz[]> {
    const response = await this.get<SharedQuiz[]>("shared-quizzes/");
    return response.data;
  }

  /**
   * Get shared quizzes for a specific quiz
   */
  async getSharedQuizzesForQuiz(quizId: string): Promise<SharedQuiz[]> {
    const response = await this.get<SharedQuiz[]>(
      `shared-quizzes/?quiz=${quizId}`,
    );
    return response.data;
  }

  /**
   * Share a quiz with a user
   */
  async shareQuizWithUser(
    quizId: string,
    userId: string,
    allowEdit = false,
  ): Promise<SharedQuiz> {
    const response = await this.post<SharedQuiz>("shared-quizzes/", {
      quiz_id: quizId,
      user_id: userId,
      allow_edit: allowEdit,
    });
    return response.data;
  }

  /**
   * Share a quiz with a group
   */
  async shareQuizWithGroup(
    quizId: string,
    groupId: string,
    allowEdit = false,
  ): Promise<SharedQuiz> {
    const response = await this.post<SharedQuiz>("shared-quizzes/", {
      quiz_id: quizId,
      study_group_id: groupId,
      allow_edit: allowEdit,
    });
    return response.data;
  }

  /**
   * Update shared quiz permissions
   */
  async updateSharedQuiz(
    sharedQuizId: string,
    allowEdit: boolean,
  ): Promise<SharedQuiz> {
    const response = await this.patch<SharedQuiz>(
      `shared-quizzes/${sharedQuizId}/`,
      {
        allow_edit: allowEdit,
      },
    );
    return response.data;
  }

  /**
   * Delete shared quiz access
   */
  async deleteSharedQuiz(sharedQuizId: string): Promise<void> {
    await this.delete(`shared-quizzes/${sharedQuizId}/`);
  }

  /**
   * Get a random question
   */
  async getRandomQuestion(): Promise<QuestionWithQuizInfo> {
    const response = await this.get<QuestionWithQuizInfo>("random-question/");
    return response.data;
  }

  /**
   * Search quizzes
   */
  async searchQuizzes(query: string): Promise<Record<string, unknown>> {
    const response = await this.get<Record<string, unknown>>(
      `search-quizzes/?query=${encodeURIComponent(query)}`,
    );
    return response.data;
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<User[]> {
    const response = await this.get<User[]>("users/", { search: query });
    return response.data;
  }

  /**
   * Delete quiz progress, guaranteed to strictly return the server's newly created session
   * or a local fallback.
   */
  async deleteQuizProgress(
    quizId: string,
    fallbackContext?: QuizWithUserProgress,
  ): Promise<QuizSession> {
    const response = await this.delete<QuizSession | null>(
      `quizzes/${quizId}/progress/`,
    );
    if (response.data !== null) {
      return response.data;
    }

    if (fallbackContext == null) {
      return {
        id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        ended_at: null,
        is_active: true,
        study_time: 0,
        current_question: null,
        answers: [],
      };
    }
    return buildFallbackSession(
      fallbackContext,
      deriveSettings(fallbackContext.user_settings),
    );
  }

  /**
   * Record an answer
   */
  async recordAnswer(
    quizId: string,
    answer: AnswerRecord,
    studyTime: number,
    nextQuestionId: string | null,
  ): Promise<AnswerRecord> {
    const response = await this.post<AnswerRecord>(
      `quizzes/${quizId}/answer/`,
      {
        question_id: answer.question,
        selected_answers: answer.selected_answers,
        study_time: studyTime,
        next_question: nextQuestionId,
      },
    );
    return response.data;
  }

  /**
   * Report question issue
   */
  async reportQuestionIssue(
    quizId: string,
    questionId: string,
    issue: string,
  ): Promise<object> {
    const response = await this.post<object>("report-question-issue/", {
      quiz_id: quizId,
      question_id: questionId,
      issue,
    });
    return response.data;
  }

  /**
   * Get study groups
   */
  async getStudyGroups(): Promise<Group[]> {
    const response = await this.get<Group[]>("study-groups/");
    return response.data;
  }

  /**
   * Get last used quizzes
   */
  async getLastUsedQuizzes(
    limit?: number,
    offset?: number,
  ): Promise<ApiPaginatedResponse<QuizMetadata>> {
    const parameters: Record<string, string> = {};
    if (limit !== undefined) {
      parameters.limit = String(limit);
    }
    if (offset !== undefined) {
      parameters.offset = String(offset);
    }

    const response = await this.get<ApiPaginatedResponse<QuizMetadata>>(
      "last-used-quizzes/",
      parameters,
    );
    return response.data;
  }

  async updateQuestion(
    questionId: string,
    data: Partial<Question>,
  ): Promise<Question> {
    const response = await this.patch<Question>(
      `questions/${questionId}/`,
      data,
    );
    return response.data;
  }

  async deleteQuestion(questionId: string): Promise<string | null> {
    const response = await this.delete<{ current_question: string | null }>(
      `questions/${questionId}/`,
    );
    return response.data.current_question;
  }
}
