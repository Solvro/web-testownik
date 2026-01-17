import type { AnswerRecord, Question, QuizSession } from "@/types/quiz.ts";

import { BaseApiService } from "./base-api.service";
import type {
  Group,
  QuestionWithQuizInfo,
  Quiz,
  QuizMetadata,
  SharedQuiz,
  User,
} from "./types";
import { STORAGE_KEYS } from "./types";

/**
 * Service for handling quiz-related API operations
 */
export class QuizService extends BaseApiService {
  /**
   * Fetch all quizzes for the current user
   */
  async getQuizzes(): Promise<QuizMetadata[]> {
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      return guestQuizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        visibility: quiz.visibility,
        allow_anonymous: quiz.allow_anonymous,
        is_anonymous: quiz.is_anonymous,
        version: quiz.version,
        can_edit: quiz.can_edit,
      }));
    }
    const response = await this.get<QuizMetadata[]>("/quizzes/");
    return response.data;
  }

  /**
   * Fetch a specific quiz by ID
   */
  async getQuiz(quizId: string): Promise<Quiz> {
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      const quiz = guestQuizzes.find((q) => q.id === quizId);
      if (quiz === undefined) {
        throw new Error("Quiz not found");
      }
      return quiz;
    }
    const response = await this.get<Quiz>(`/quizzes/${quizId}/`);
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
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      const newQuiz: Quiz = {
        id: crypto.randomUUID(),
        title: quizData.title,
        description: quizData.description,
        questions: quizData.questions as Question[],
        visibility: 0,
        allow_anonymous: false,
        is_anonymous: true,
        version: 1,
        can_edit: true,
      };
      guestQuizzes.push(newQuiz);
      this.saveGuestQuizzes(guestQuizzes);
      return newQuiz;
    }
    const response = await this.post<Quiz>("/quizzes/", quizData);
    return response.data;
  }

  /**
   * Update an existing quiz
   */
  async updateQuiz(quizId: string, quizData: Partial<Quiz>): Promise<Quiz> {
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      const quizIndex = guestQuizzes.findIndex((q) => q.id === quizId);
      if (quizIndex === -1) {
        throw new Error("Quiz not found");
      }
      const updatedQuiz: Quiz = {
        ...guestQuizzes[quizIndex],
        ...quizData,
      };
      guestQuizzes[quizIndex] = updatedQuiz;
      this.saveGuestQuizzes(guestQuizzes);
      return updatedQuiz;
    }
    const response = await this.patch<Quiz>(`/quizzes/${quizId}/`, quizData);
    return response.data;
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId: string): Promise<void> {
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      const filteredQuizzes = guestQuizzes.filter((q) => q.id !== quizId);
      if (filteredQuizzes.length === guestQuizzes.length) {
        throw new Error("Quiz not found");
      }
      this.saveGuestQuizzes(filteredQuizzes);
      return;
    }
    await this.delete(`/quizzes/${quizId}/`);
  }

  /**
   * Get shared quizzes
   */
  async getSharedQuizzes(): Promise<SharedQuiz[]> {
    if (this.isGuestMode()) {
      return [];
    }
    const response = await this.get<SharedQuiz[]>("/shared-quizzes/");
    return response.data;
  }

  /**
   * Get shared quizzes for a specific quiz
   */
  async getSharedQuizzesForQuiz(quizId: string): Promise<SharedQuiz[]> {
    if (this.isGuestMode()) {
      return [];
    }
    const response = await this.get<SharedQuiz[]>(
      `/shared-quizzes/?quiz=${quizId}`,
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
    if (this.isGuestMode()) {
      throw new Error("Cannot share quizzes in guest mode");
    }
    const response = await this.post<SharedQuiz>("/shared-quizzes/", {
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
    if (this.isGuestMode()) {
      throw new Error("Cannot share quizzes in guest mode");
    }
    const response = await this.post<SharedQuiz>("/shared-quizzes/", {
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
    if (this.isGuestMode()) {
      throw new Error("Cannot update shared quizzes in guest mode");
    }
    const response = await this.patch<SharedQuiz>(
      `/shared-quizzes/${sharedQuizId}/`,
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
    if (this.isGuestMode()) {
      throw new Error("Cannot delete shared quizzes in guest mode");
    }
    await this.delete(`/shared-quizzes/${sharedQuizId}/`);
  }

  /**
   * Get a random question
   */
  async getRandomQuestion(): Promise<QuestionWithQuizInfo> {
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      if (guestQuizzes.length === 0) {
        throw new Error("No questions available");
      }
      const randomQuiz =
        guestQuizzes[Math.floor(Math.random() * guestQuizzes.length)];
      const randomQuestion =
        randomQuiz.questions[
          Math.floor(Math.random() * randomQuiz.questions.length)
        ];
      return {
        ...randomQuestion,
        quiz_title: randomQuiz.title,
        quiz_id: randomQuiz.id,
      };
    }
    const response = await this.get<QuestionWithQuizInfo>("/random-question/");
    return response.data;
  }

  /**
   * Search quizzes
   */
  async searchQuizzes(query: string): Promise<Record<string, unknown>> {
    if (this.isGuestMode()) {
      const guestQuizzes = this.getGuestQuizzes();
      const filteredQuizzes = guestQuizzes.filter((quiz) =>
        quiz.title.toLowerCase().includes(query.toLowerCase()),
      );
      return { guest: filteredQuizzes };
    }
    const response = await this.get<Record<string, unknown>>(
      `/search-quizzes/?query=${encodeURIComponent(query)}`,
    );
    return response.data;
  }

  /**
   * Search for users
   */
  async searchUsers(query: string): Promise<User[]> {
    if (this.isGuestMode()) {
      return [];
    }
    const response = await this.get<User[]>("/users/", { search: query });
    return response.data;
  }

  /**
   * Get quiz progress
   */
  async getQuizProgress(
    quizId: string,
    applyRemote = true,
  ): Promise<QuizSession | null> {
    if (!this.isGuestMode() && applyRemote) {
      try {
        const response = await this.get<QuizSession>(
          `/quizzes/${quizId}/progress/`,
        );
        return response.data;
      } catch {
        // If remote fetch fails, return local progress if available
      }
    }
    const localProgress = localStorage.getItem(
      STORAGE_KEYS.QUIZ_PROGRESS(quizId),
    );
    if (localProgress !== null) {
      try {
        return JSON.parse(localProgress) as QuizSession;
      } catch (error) {
        console.error("Error parsing local quiz progress:", error);
        localStorage.removeItem(STORAGE_KEYS.QUIZ_PROGRESS(quizId));
      }
    }
    return null;
  }

  /**
   * Delete quiz progress
   */
  async deleteQuizProgress(quizId: string, applyRemote = true): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.QUIZ_PROGRESS(quizId));
    if (!this.isGuestMode() && applyRemote) {
      await this.delete(`/quizzes/${quizId}/progress/`);
    }
  }

  /**
   * Record an answer
   */
  async recordAnswer(
    quizId: string,
    answer: AnswerRecord,
    studyTime?: number,
    nextQuestionId?: string | null,
  ): Promise<AnswerRecord> {
    if (this.isGuestMode()) {
      try {
        const key = STORAGE_KEYS.QUIZ_PROGRESS(quizId);
        const existing = localStorage.getItem(key);
        let session: QuizSession;

        if (existing === null) {
          session = {
            id: crypto.randomUUID(),
            started_at: new Date().toISOString(),
            ended_at: null,
            is_active: true,
            study_time: studyTime ?? 0,
            current_question: null,
            answers: [],
          };
        } else {
          try {
            session = JSON.parse(existing) as QuizSession;
            if (!Array.isArray(session.answers)) {
              session.answers = [];
            }
          } catch {
            session = {
              id: crypto.randomUUID(),
              started_at: new Date().toISOString(),
              ended_at: null,
              is_active: true,
              study_time: studyTime ?? 0,
              current_question: null,
              answers: [],
            };
          }
        }

        session.answers.push(answer);
        if (nextQuestionId != null) {
          session.current_question = nextQuestionId;
        }
        if (studyTime !== undefined) {
          session.study_time = studyTime;
        }

        localStorage.setItem(key, JSON.stringify(session));
      } catch (error) {
        console.error("Failed to persist guest progress:", error);
      }

      return answer;
    }
    const response = await this.post<AnswerRecord>(
      `/quizzes/${quizId}/answer/`,
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
    if (this.isGuestMode()) {
      throw new Error("Cannot report question issues in guest mode");
    }
    const response = await this.post<object>("/report-question-issue/", {
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
    if (this.isGuestMode()) {
      return [];
    }
    const response = await this.get<Group[]>("/study-groups/");
    return response.data;
  }

  /**
   * Get guest quizzes from localStorage
   */
  getGuestQuizzes(): Quiz[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GUEST_QUIZZES);
      if (stored !== null && stored.trim() !== "") {
        return JSON.parse(stored) as Quiz[];
      }
      return [];
    } catch (error) {
      console.error("Error parsing guest quizzes:", error);
      return [];
    }
  }

  /**
   * Save guest quizzes to localStorage
   */
  saveGuestQuizzes(quizzes: Quiz[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_QUIZZES, JSON.stringify(quizzes));
    } catch (error) {
      console.error("Error saving guest quizzes:", error);
    }
  }

  /**
   * Check if user is in guest mode
   */
  isGuestMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.IS_GUEST) === "true";
  }

  /**
   * Get last used quizzes
   */
  async getLastUsedQuizzes(limit?: number): Promise<QuizMetadata[]> {
    if (this.isGuestMode()) {
      return this.getGuestQuizzes().slice(0, limit ?? 10);
    }
    const parameters =
      limit === undefined ? undefined : { limit: String(limit) };
    const response = await this.get<QuizMetadata[]>(
      "/last-used-quizzes/",
      parameters,
    );
    return response.data;
  }
}
