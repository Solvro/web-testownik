import type { AIModelsResponse } from "@/lib/ai/models";
import type {
  AIAccountLimitRow,
  AIAdminPermissions,
  AIAdminStats,
  AIAdminUser,
  AILimitsResetResult,
  AIModelRow,
  AIUsageEventPage,
  AIUsageSettingsRow,
  AIUserLimitOverride,
} from "@/types/ai-admin";
import type { AIUsageSummary } from "@/types/ai-usage";

import { BaseApiService } from "./base-api.service";
import type {
  AuthorizedApp,
  GradesData,
  UserData,
  UserSettings,
} from "./types";

/**
 * Service for handling user-related API operations
 */
export class UserService extends BaseApiService {
  async getAIAdminPermissions(): Promise<AIAdminPermissions> {
    const response = await this.get<AIAdminPermissions>(
      "ai/usage/admin/permissions/",
    );
    return response.data;
  }

  async getAIAdminLimits(): Promise<AIAccountLimitRow[]> {
    const response = await this.get<AIAccountLimitRow[]>(
      "ai/usage/admin/limits/",
    );
    return response.data;
  }

  async updateAIAdminLimits(
    rows: AIAccountLimitRow[],
  ): Promise<AIAccountLimitRow[]> {
    const response = await this.put<AIAccountLimitRow[]>(
      "ai/usage/admin/limits/",
      rows,
    );
    return response.data;
  }

  async resetAIAdminLimits(): Promise<AILimitsResetResult> {
    const response = await this.post<AILimitsResetResult>(
      "ai/usage/admin/limits/reset/",
    );
    return response.data;
  }

  async getAIAdminStats(): Promise<AIAdminStats> {
    const response = await this.get<AIAdminStats>("ai/usage/admin/stats/");
    return response.data;
  }

  async getAIAdminUsers(
    query: string,
    overridesOnly = false,
  ): Promise<AIAdminUser[]> {
    const response = await this.get<AIAdminUser[]>("ai/usage/admin/users/", {
      q: query,
      overrides_only: overridesOnly,
    });
    return response.data;
  }

  async getAIModels(): Promise<AIModelsResponse> {
    const response = await this.get<AIModelsResponse>("ai/models/");
    return response.data;
  }

  async getAIAdminModels(): Promise<AIModelRow[]> {
    const response = await this.get<AIModelRow[]>("ai/usage/admin/models/");
    return response.data;
  }

  async createAIAdminModel(row: AIModelRow): Promise<AIModelRow> {
    const response = await this.post<AIModelRow>("ai/usage/admin/models/", row);
    return response.data;
  }

  async deleteAIAdminModel(model: string): Promise<void> {
    await this.delete(`ai/usage/admin/models/${encodeURIComponent(model)}/`);
  }

  async updateAIAdminModels(rows: AIModelRow[]): Promise<AIModelRow[]> {
    const response = await this.put<AIModelRow[]>(
      "ai/usage/admin/models/bulk/",
      rows,
    );
    return response.data;
  }

  async getAIAdminSettings(): Promise<AIUsageSettingsRow> {
    const response = await this.get<AIUsageSettingsRow>(
      "ai/usage/admin/settings/",
    );
    return response.data;
  }

  async updateAIAdminSettings(
    settings: AIUsageSettingsRow,
  ): Promise<AIUsageSettingsRow> {
    const response = await this.put<AIUsageSettingsRow>(
      "ai/usage/admin/settings/",
      settings,
    );
    return response.data;
  }

  async getAIUserOverride(
    userId: string,
  ): Promise<Partial<AIUserLimitOverride>> {
    const response = await this.get<Partial<AIUserLimitOverride>>(
      `ai/usage/admin/users/${userId}/limit/`,
    );
    return response.data;
  }

  async updateAIUserOverride(
    userId: string,
    override: AIUserLimitOverride,
  ): Promise<AIUserLimitOverride> {
    const response = await this.put<AIUserLimitOverride>(
      `ai/usage/admin/users/${userId}/limit/`,
      override,
    );
    return response.data;
  }

  async deleteAIUserOverride(userId: string): Promise<void> {
    await this.delete(`ai/usage/admin/users/${userId}/limit/`);
  }

  async getAIUserEvents(
    userId: string,
    { limit = 10, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<AIUsageEventPage> {
    const response = await this.get<AIUsageEventPage>(
      `ai/usage/admin/users/${userId}/events/`,
      { limit, offset },
    );
    return response.data;
  }

  async getAIUsage(days = 30): Promise<AIUsageSummary> {
    const response = await this.get<AIUsageSummary>("ai/usage/me/", { days });
    return response.data;
  }
  /**
   * Fetch current user data
   */
  async getUserData(): Promise<UserData> {
    const response = await this.get<UserData>("user/");
    return response.data;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userData: Partial<UserData>): Promise<UserData> {
    const response = await this.patch<UserData>("user/", userData);
    return response.data;
  }

  /**
   * Get user settings
   */
  async getUserSettings(): Promise<UserSettings> {
    const response = await this.get<UserSettings>("settings/");
    return response.data;
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    settings: Partial<UserSettings>,
  ): Promise<UserSettings> {
    const response = await this.patch<UserSettings>("settings/", settings);
    return response.data;
  }

  /**
   * Get user grades
   */
  async getGrades(): Promise<GradesData> {
    const response = await this.get<GradesData>("grades/");
    return response.data;
  }

  /**
   * Get OAuth applications authorized by the current user
   */
  async getAuthorizedApps(): Promise<AuthorizedApp[]> {
    const response = await this.get<AuthorizedApp[]>("oauth/authorized-apps/");
    return response.data;
  }

  /**
   * Revoke an OAuth application's tokens
   */
  async deleteAuthorizedApp(clientId: string): Promise<void> {
    await this.delete(`oauth/authorized-apps/${encodeURIComponent(clientId)}/`);
  }

  /**
   * Generate OTP for login
   */
  async generateOTP(email: string): Promise<{ message: string }> {
    const response = await this.post<{ message: string }>("generate-otp/", {
      email,
    });
    return response.data;
  }

  /**
   * Send feedback/bug report
   */
  async sendFeedback(feedbackData: Record<string, unknown>): Promise<object> {
    const response = await this.post<object>("feedback/send", feedbackData);
    return response.data;
  }
}
