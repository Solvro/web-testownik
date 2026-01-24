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
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { API_URL } from "@/lib/api";

interface NavLinksProps {
  isStaff: boolean;
  variant?: "desktop" | "mobile";
}

export function NavLinks({ isStaff, variant = "desktop" }: NavLinksProps) {
  const pathname = usePathname();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const appContext = useContext(AppContext);
  const queryClient = useQueryClient();

  const prefetchGrades = () => {
    if (
      !appContext.isAuthenticated ||
      !(appContext.user?.student_number ?? "")
    ) {
      return;
    }
    void queryClient.prefetchQuery({
      queryKey: ["grades"],
      queryFn: async () => appContext.services.user.getGrades(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const isActive = (path: string) => pathname === path;

  if (variant === "mobile") {
    return (
      <>
        <Link
          href="/quizzes"
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
          Zgłoś błąd
        </Button>
        {isStaff ? (
          <a
            href={`${API_URL}/admin/`}
            target="_blank"
            className="text-muted-foreground hover:text-foreground transition-colors"
            rel="noreferrer"
          >
            Panel administratora
          </a>
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
      <NavigationMenu className="hidden sm:flex" viewport={false}>
        <NavigationMenuList className="gap-1">
          <NavigationMenuItem>
            <NavigationMenuLink active={isActive("/quizzes")} asChild>
              <Link href="/quizzes">Twoje quizy</Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink active={isActive("/grades")} asChild>
              <Link href="/grades" onMouseEnter={prefetchGrades}>
                Oceny
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              onClick={() => {
                setShowReportDialog(true);
              }}
              asChild
            >
              <Button variant="ghost" className="font-normal">
                Zgłoś błąd
              </Button>
            </NavigationMenuLink>
          </NavigationMenuItem>
          {isStaff ? (
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <a
                  href={`${API_URL}/admin/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex"
                >
                  Panel administratora
                </a>
              </NavigationMenuLink>
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
