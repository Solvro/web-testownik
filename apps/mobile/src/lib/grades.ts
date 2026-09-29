import type { GradesData } from "@testownik/core/user/types";
import { ApiError } from "./client";

/** The existing USOS endpoint distinguishes no published grades with this 404. */
export async function loadGrades(
  request: () => Promise<GradesData>,
): Promise<GradesData> {
  try {
    return await request();
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.message === "No grade data found for this user."
    ) {
      return { terms: [], courses: [] };
    }
    throw error;
  }
}
