"use client";

import {
  CircleUserRoundIcon,
  CloudUploadIcon,
  IdCardLanyardIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

import { AppContext } from "@/app-context";
import { AppLogo } from "@/components/app-logo";
import { CopyJWTAccessTokenButton } from "@/components/copy-jwt-button";
import { ModeToggle } from "@/components/mode-toggle";
import { ReportBugDialog } from "@/components/report-bug-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { SERVER_URL } from "@/config";

export function Navbar() {
  const appContext = useContext(AppContext);
  const router = useRouter();
  const pathname = usePathname();
  const searchParameters = useSearchParams();

  const [expanded, setExpanded] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  useEffect(() => {
    setIsStaff(localStorage.getItem("is_staff") === "true");
    setProfilePicture(localStorage.getItem("profile_picture"));
  }, [appContext.isAuthenticated]);

  const accessToken = searchParameters.get("access_token");
  const refreshToken = searchParameters.get("refresh_token");

  const handleLogin = useCallback(async () => {
    if (accessToken !== null && refreshToken !== null) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem(
        "access_token_expires_at",
        (Date.now() + 3600 * 1000).toString(),
      );

      const newParameters = new URLSearchParams(searchParameters.toString());
      newParameters.delete("access_token");
      newParameters.delete("refresh_token");

      const newSearch = newParameters.toString();
      const newUrl = pathname + (newSearch ? `?${newSearch}` : "");

      router.replace(newUrl);

      const user = await appContext.services.user.getUserData();
      appContext.services.user.storeUserData(user);
      appContext.setAuthenticated(true);
    }
  }, [
    accessToken,
    refreshToken,
    searchParameters,
    pathname,
    router,
    appContext,
  ]);

  useEffect(() => {
    void handleLogin();
  }, [handleLogin]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("access_token_expires_at");
    appContext.services.user.clearStoredUserData();
    appContext.setAuthenticated(false);
    setIsStaff(false);
    setProfilePicture(null);
    router.push("/");
  };

  const isActive = (path: string) => pathname === path;

  const [loginUrl, setLoginUrl] = useState(`${SERVER_URL}/login/usos?jwt=true`);

  const [isMounted, setIsMounted] = useState(false);

  useLayoutEffect(() => {
    setIsMounted(true);
    setLoginUrl(
      `${SERVER_URL}/login/usos?jwt=true&redirect=${window.location.href}`,
    );
  }, []);

  const isAuthenticatedSafe = isMounted && appContext.isAuthenticated;
  const isGuestSafe = isMounted && appContext.isGuest;

  return (
    <nav className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-4 sm:px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <AppLogo width={40} />
          </Link>
          <NavigationMenu className="hidden sm:flex" viewport={false}>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink active={isActive("/quizzes")} asChild>
                  <Link href="/quizzes">Twoje quizy</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink active={isActive("/grades")} asChild>
                  <Link href="/grades">Oceny</Link>
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
                      href={`${SERVER_URL}/admin/`}
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
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {isMounted ? <CopyJWTAccessTokenButton /> : null}
          <ModeToggle />
          {isGuestSafe ? (
            <>
              <Button variant="default" asChild>
                <Link href="/profile">
                  <IdCardLanyardIcon />
                  <span>Gość</span>
                </Link>
              </Button>
              <Button variant="outline" size="icon" className="p-2" asChild>
                <Link href="/connect-account">
                  <CloudUploadIcon />
                </Link>
              </Button>
            </>
          ) : isAuthenticatedSafe ? (
            <>
              <Button variant="default" asChild>
                <Link href="/profile">
                  {profilePicture === null ? (
                    <CircleUserRoundIcon className="size-6" />
                  ) : (
                    <Avatar className="size-6">
                      <AvatarImage
                        src={profilePicture}
                        className="user-avatar"
                      />
                      <AvatarFallback delayMs={600} className="bg-transparent">
                        <CircleUserRoundIcon className="size-6" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span>Profil</span>
                </Link>
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleLogout}
                className="p-2"
              >
                <LogOutIcon />
              </Button>
            </>
          ) : (
            <Button variant="default" asChild>
              <a href={loginUrl}>
                <LogInIcon />
                Zaloguj się
              </a>
            </Button>
          )}
        </div>
        <Button
          aria-label="Menu"
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <XIcon className="size-6" />
          ) : (
            <MenuIcon className="size-6" />
          )}
        </Button>
      </div>
      {expanded ? (
        <div className="flex flex-col gap-4 border-t pt-2 sm:hidden">
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
              href={`${SERVER_URL}/admin/`}
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
              rel="noreferrer"
            >
              Panel administratora
            </a>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {isGuestSafe ? (
              <>
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/profile">
                    <IdCardLanyardIcon />
                    <span>Gość</span>
                  </Link>
                </Button>
                <Button variant="outline" size="icon" className="p-2" asChild>
                  <Link href="/connect-account">
                    <CloudUploadIcon />
                  </Link>
                </Button>
              </>
            ) : isAuthenticatedSafe ? (
              <>
                <Button variant="default" className="flex-1" asChild>
                  <Link href="/profile">
                    {profilePicture === null ? (
                      <CircleUserRoundIcon className="size-6" />
                    ) : (
                      <Avatar className="size-6">
                        <AvatarImage
                          className="user-avatar"
                          src={profilePicture}
                        />
                        <AvatarFallback
                          delayMs={600}
                          className="bg-transparent"
                        >
                          <CircleUserRoundIcon className="size-6" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span>Profil</span>
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleLogout}
                  className="p-2"
                >
                  <LogOutIcon />
                </Button>
              </>
            ) : (
              <Button variant="outline" asChild className="flex-1">
                <a href={loginUrl}>
                  <LogInIcon />
                  Zaloguj się
                </a>
              </Button>
            )}
            {isMounted ? <CopyJWTAccessTokenButton /> : null}
            <ModeToggle />
          </div>
        </div>
      ) : null}
      <ReportBugDialog
        open={showReportDialog}
        onOpenChange={(open) => {
          setShowReportDialog(open);
        }}
      />
    </nav>
  );
}
