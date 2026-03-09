import { BaseApiService } from "./base-api.service";
import type { AlertData, GradesData, UserData, UserSettings } from "./types";

/**
 * Service for handling user-related API operations
 */
export class UserService extends BaseApiService {
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
   * Generate OTP for login
   */
  async generateOTP(email: string): Promise<{ message: string }> {
    const response = await this.post<{ message: string }>("generate-otp/", {
      email,
    });
    return response.data;
  }

  /**
   * Get alerts
   */
  async getAlerts(): Promise<AlertData[]> {
    const response = await this.get<AlertData[]>("alerts/");
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
