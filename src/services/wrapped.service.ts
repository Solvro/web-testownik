import type { WrappedData } from "@/types/wrapped";

import { BaseApiService } from "./base-api.service";

/**
 * Service for the Testownik Wrapped end-of-semester summary.
 */
export class WrappedService extends BaseApiService {
  /** The current user's latest Wrapped report. */
  async getWrapped(): Promise<WrappedData> {
    const response = await this.get<WrappedData>("wrapped/");
    return response.data;
  }

  /** The platform-wide (global) Wrapped for the latest term. */
  async getGlobalWrapped(): Promise<WrappedData> {
    const response = await this.get<WrappedData>("wrapped/global/");
    return response.data;
  }
}
