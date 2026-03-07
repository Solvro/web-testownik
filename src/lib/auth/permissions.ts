import { ACCOUNT_TYPE } from "@/types/user";
import type { AccountType } from "@/types/user";

export enum PermissionAction {
  SEARCH_QUIZZES = "search_quizzes",
  VIEW_SHARED_QUIZZES = "view_shared_quizzes",
  SHARE_QUIZZES = "share_quizzes",
  COPY_QUIZZES = "copy_quizzes",
  REPORT_ISSUES = "report_issues",
  VIEW_GRADES = "view_grades",
}

export const PERMISSIONS_BY_ROLE: Record<
  AccountType | "unauthenticated",
  PermissionAction[]
> = {
  unauthenticated: [],
  [ACCOUNT_TYPE.GUEST]: [],
  [ACCOUNT_TYPE.EMAIL]: [
    PermissionAction.VIEW_SHARED_QUIZZES,
    PermissionAction.SHARE_QUIZZES,
    PermissionAction.COPY_QUIZZES,
    PermissionAction.REPORT_ISSUES,
  ],
  [ACCOUNT_TYPE.STUDENT]: [
    PermissionAction.SEARCH_QUIZZES,
    PermissionAction.VIEW_SHARED_QUIZZES,
    PermissionAction.SHARE_QUIZZES,
    PermissionAction.COPY_QUIZZES,
    PermissionAction.REPORT_ISSUES,
    PermissionAction.VIEW_GRADES,
  ],
  [ACCOUNT_TYPE.LECTURER]: [
    PermissionAction.SEARCH_QUIZZES,
    PermissionAction.VIEW_SHARED_QUIZZES,
    PermissionAction.SHARE_QUIZZES,
    PermissionAction.COPY_QUIZZES,
    PermissionAction.REPORT_ISSUES,
    PermissionAction.VIEW_GRADES,
  ],
};

export function hasPermission(
  accountType: AccountType | undefined,
  action: PermissionAction,
): boolean {
  return PERMISSIONS_BY_ROLE[accountType ?? "unauthenticated"].includes(action);
}
