"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useState } from "react";

import { AppContext } from "@/app-context";
import { ReportBugDialog } from "@/components/report-bug-dialog";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { API_URL } from "@/lib/api";
import { PermissionAction } from "@/lib/auth/permissions";
import { getUserService } from "@/services";

interface NavLinksProps {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function NavLinks({ variant = "desktop", onNavigate }: NavLinksProps) {
  const { user, checkPermission } = useContext(AppContext);
  const isStaff = user?.is_staff ?? false;

  const pathname = usePathname();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const queryClient = useQueryClient();

  const prefetchGrades = () => {
    if (!checkPermission(PermissionAction.VIEW_GRADES)) {
      return;
    }
    void queryClient.prefetchQuery({
      queryKey: ["grades"],
      queryFn: async () => getUserService().getGrades(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const isActive = (path: string) => pathname === path;

  if (variant === "mobile") {
    return (
      <>
        <Link
          href="/quizzes"
          onClick={onNavigate}
          className={
            isActive("/quizzes")
              ? "text-foreground text-left font-medium"
              : "text-muted-foreground hover:text-foreground text-left transition-colors"
          }
        >
          Twoje quizy
        </Link>
        <Link
          href="/grades"
          onClick={onNavigate}
          onMouseEnter={prefetchGrades}
          className={
            isActive("/grades")
              ? "text-foreground text-left font-medium"
              : "text-muted-foreground hover:text-foreground text-left transition-colors"
          }
        >
          Oceny
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            setShowReportDialog(true);
          }}
          className="text-muted-foreground hover:text-foreground h-auto justify-start p-0 text-left text-base font-normal transition-colors"
        >
          Prześlij opinię
        </Button>
        {isStaff ? (
          <div className="mt-1 flex flex-col gap-2 border-t pt-2">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              Admin
            </p>
            <Link
              href="/admin/ai"
              onClick={onNavigate}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Ustawienia AI
            </Link>
            <a
              href={`${API_URL}/admin/`}
              target="_blank"
              onClick={onNavigate}
              className="text-muted-foreground hover:text-foreground transition-colors"
              rel="noreferrer"
            >
              Panel administratora
            </a>
          </div>
        ) : null}
        <ReportBugDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
        />
      </>
    );
  }

  return (
    <>
      <NavigationMenu className="hidden md:flex">
        <NavigationMenuList className="gap-2.5">
          <NavigationMenuItem>
            <NavigationMenuLink
              data-active={isActive("/quizzes")}
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              render={<Link href="/quizzes" />}
              className={navigationMenuTriggerStyle()}
            >
              Twoje quizy
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              data-active={isActive("/grades")}
              // eslint-disable-next-line jsx-a11y/anchor-has-content
              render={<Link href="/grades" onMouseEnter={prefetchGrades} />}
              className={navigationMenuTriggerStyle()}
            >
              Oceny
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              data-active={showReportDialog}
              onClick={() => {
                setShowReportDialog(true);
              }}
              render={
                <Button
                  variant="ghost"
                  className={navigationMenuTriggerStyle()}
                />
              }
            >
              Prześlij opinię
            </NavigationMenuLink>
          </NavigationMenuItem>
          {isStaff ? (
            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <span className="pointer-fine:hidden">Admin</span>
                <a
                  href={`${API_URL}/admin/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Admin
                </a>
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-50">
                  <li>
                    <NavigationMenuLink
                      closeOnClick
                      data-active={pathname.startsWith("/admin/ai")}
                      // eslint-disable-next-line jsx-a11y/anchor-has-content
                      render={<Link href="/admin/ai" />}
                    >
                      Ustawienia AI
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink
                      closeOnClick
                      render={
                        // eslint-disable-next-line jsx-a11y/anchor-has-content
                        <a
                          href={`${API_URL}/admin/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      Panel administratora
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ) : null}
        </NavigationMenuList>
      </NavigationMenu>
      <ReportBugDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
      />
    </>
  );
}
