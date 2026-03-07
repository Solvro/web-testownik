import { ACCOUNT_TYPE } from "@/types/user";
import type { AccountType } from "@/types/user";

export enum PermissionAction {
  // Searching and browsing public quizzes
  BROWSE_PUBLIC_QUIZZES = "browse_public_quizzes",
  // Viewing shared quizzes
  VIEW_SHARED_QUIZZES = "view_shared_quizzes",
  // Sharing quizzes with others
  SHARE_QUIZZES = "share_quizzes",
  // Reporting quiz issues to its maintainers
  REPORT_QUIZ_ISSUES = "report_quiz_issues",
  // Viewing users' grades
  VIEW_GRADES = "view_grades",
  // Manage notification settings
  NOTIFICATION_SETTINGS = "notification_settings",
  // Searching within quiz questions and answers
  SEARCH_IN_QUIZ = "search_in_quiz",
  // Accessing quiz continuity features - sharing quiz progress across devices in real-time
  QUIZ_CONTINUITY = "quiz_continuity",
}

export const PERMISSIONS_BY_ROLE: Record<
  AccountType | "unauthenticated",
  PermissionAction[]
> = {
  unauthenticated: [],
  [ACCOUNT_TYPE.GUEST]: [
    PermissionAction.REPORT_QUIZ_ISSUES,
    PermissionAction.SEARCH_IN_QUIZ,
  ],
  [ACCOUNT_TYPE.EMAIL]: [
    PermissionAction.VIEW_SHARED_QUIZZES,
    PermissionAction.SHARE_QUIZZES,
    PermissionAction.REPORT_QUIZ_ISSUES,
    PermissionAction.NOTIFICATION_SETTINGS,
    PermissionAction.SEARCH_IN_QUIZ,
    PermissionAction.QUIZ_CONTINUITY,
  ],
  [ACCOUNT_TYPE.STUDENT]: [
    PermissionAction.BROWSE_PUBLIC_QUIZZES,
    PermissionAction.VIEW_SHARED_QUIZZES,
    PermissionAction.SHARE_QUIZZES,
    PermissionAction.REPORT_QUIZ_ISSUES,
    PermissionAction.VIEW_GRADES,
    PermissionAction.NOTIFICATION_SETTINGS,
    PermissionAction.SEARCH_IN_QUIZ,
    PermissionAction.QUIZ_CONTINUITY,
  ],
  [ACCOUNT_TYPE.LECTURER]: [
    PermissionAction.VIEW_SHARED_QUIZZES,
    PermissionAction.SHARE_QUIZZES,
    PermissionAction.REPORT_QUIZ_ISSUES,
    PermissionAction.VIEW_GRADES,
    PermissionAction.NOTIFICATION_SETTINGS,
    PermissionAction.QUIZ_CONTINUITY,
  ],
};

export function hasPermission(
  accountType: AccountType | undefined,
  action: PermissionAction,
): boolean {
  return PERMISSIONS_BY_ROLE[accountType ?? "unauthenticated"].includes(action);
}
