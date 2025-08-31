import {
  CircleUserRoundIcon,
  CloudUploadIcon,
  IdCardLanyardIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";

import AppLogo from "@/components/app-logo.tsx";
import { ModeToggle } from "@/components/mode-toggle.tsx";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

import AppContext from "../app-context.tsx";
import { SERVER_URL } from "../config.ts";
import { ReportBugModal } from "./report-bug-modal.tsx";

function Navbar() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [expanded, setExpanded] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const queryParameters = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const accessToken = queryParameters.get("access_token");
  const refreshToken = queryParameters.get("refresh_token");

  const handleLogin = useCallback(async () => {
    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      queryParameters.delete("access_token");
      queryParameters.delete("refresh_token");

      navigate({
        search: queryParameters.toString(),
      });

      await appContext.fetchUserData();
    }
  }, [accessToken, refreshToken, queryParameters, navigate]);

  useEffect(() => {
    handleLogin();
  }, [handleLogin]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("profile_picture");
    localStorage.removeItem("is_staff");
    localStorage.removeItem("user_id");
    appContext.setAuthenticated(false);
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-4 sm:px-4">
        <div className="flex items-center gap-6">
          <Link to="/">
            <AppLogo width={40} />
          </Link>
          <NavigationMenu className="hidden sm:flex" viewport={false}>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink active={isActive("/quizzes")} asChild>
                  <Link to="/quizzes">Twoje quizy</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink active={isActive("/grades")} asChild>
                  <Link to="/grades">Oceny</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  onClick={() => {
                    setShowReportModal(true);
                  }}
                  asChild
                >
                  <Link to="#">Zgłoś błąd</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              {localStorage.getItem("is_staff") === "true" && (
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
              )}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <ModeToggle />
          {appContext.isGuest ? (
            <>
              <Link to="/profile">
                <Button variant="default">
                  <IdCardLanyardIcon />
                  <span>Gość</span>
                </Button>
              </Link>
              <Link to="/connect-account">
                <Button variant="secondary" className="p-2">
                  <CloudUploadIcon />
                </Button>
              </Link>
            </>
          ) : appContext.isAuthenticated ? (
            <>
              <Link to="/profile">
                <Button variant="default">
                  {localStorage.getItem("profile_picture") ? (
                    <img
                      src={localStorage.getItem("profile_picture")!}
                      alt="Profilowe"
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <CircleUserRoundIcon className="size-6" />
                  )}
                  <span>Profil</span>
                </Button>
              </Link>
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
              <a
                href={`${SERVER_URL}/login/usos?jwt=true&redirect=${document.location}`}
              >
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
            to="/quizzes"
            className={
              isActive("/quizzes")
                ? "text-foreground text-left font-medium"
                : "text-muted-foreground hover:text-foreground text-left transition-colors"
            }
          >
            Twoje quizy
          </Link>
          <Link
            to="/grades"
            className={
              isActive("/grades")
                ? "text-foreground text-left font-medium"
                : "text-muted-foreground hover:text-foreground text-left transition-colors"
            }
          >
            Oceny
          </Link>
          <Link
            to="#"
            onClick={() => {
              setShowReportModal(true);
            }}
            className="text-muted-foreground hover:text-foreground text-left transition-colors"
          >
            Zgłoś błąd
          </Link>
          {localStorage.getItem("is_staff") === "true" && (
            <a
              href={`${SERVER_URL}/admin/`}
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors"
              rel="noreferrer"
            >
              Panel administratora
            </a>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {appContext.isGuest ? (
              <>
                <Link to="/profile">
                  <Button variant="outline" className="flex-1">
                    <IdCardLanyardIcon />
                    <span>Gość</span>
                  </Button>
                </Link>
                <Link to="/connect-account">
                  <Button variant="secondary" className="p-2">
                    <CloudUploadIcon />
                  </Button>
                </Link>
              </>
            ) : appContext.isAuthenticated ? (
              <>
                <Link to="/profile">
                  <Button variant="default" className="flex-1">
                    {localStorage.getItem("profile_picture") ? (
                      <img
                        src={localStorage.getItem("profile_picture")!}
                        alt="Profilowe"
                        className="size-6 rounded-full object-cover"
                      />
                    ) : (
                      <CircleUserRoundIcon className="size-6" />
                    )}
                    <span>Profil</span>
                  </Button>
                </Link>
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
                <a
                  href={`${SERVER_URL}/login/usos?jwt=true&redirect=${document.location}`}
                >
                  <LogInIcon />
                  Zaloguj się
                </a>
              </Button>
            )}
          </div>
        </div>
      ) : null}
      <ReportBugModal
        show={showReportModal}
        onHide={() => {
          setShowReportModal(false);
        }}
      />
    </nav>
  );
}

export { Navbar };
