import React, { useContext } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router";

import { AppContext } from "@/app-context.ts";
import { AppLogo } from "@/components/app-logo.tsx";
import { ToastContainer } from "@/components/toast-container.tsx";

import { Alerts } from "./components/alerts.tsx";
import { ConnectGuestAccount } from "./components/connect-guest-account.tsx";
import { LoginPrompt } from "./components/login-prompt.tsx";
import { Navbar } from "./components/navbar.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { CreateQuizPage } from "./pages/create-quiz-page.tsx";
import { DashboardPage } from "./pages/dashboard-page.tsx";
import { EditQuizPage } from "./pages/edit-quiz-page.tsx";
import { Error404Page } from "./pages/errors/error404-page.tsx";
import { GradesPage } from "./pages/grades-page.tsx";
import { ImportQuizLegacyPage } from "./pages/import-quiz-legacy-page.tsx";
import { ImportQuizPage } from "./pages/import-quiz-page.tsx";
import { LoginLinkPage } from "./pages/login-link-page.tsx";
import { OTPLoginPage } from "./pages/otp-login-page.tsx";
import { PrivacyPolicyPage } from "./pages/privacy-policy-page.tsx";
import { ProfilePage } from "./pages/profile-page.tsx";
import { QuizPage } from "./pages/quiz-page.tsx";
import { QuizzesPage } from "./pages/quizzes-page.tsx";
import { SearchInQuizPage } from "./pages/search-in-quiz-page.tsx";
import { TermsPage } from "./pages/terms-page.tsx";

export function App(): React.JSX.Element {
  const context = useContext(AppContext);

  return (
    <Router>
      <ThemeProvider storageKey="vite-ui-theme">
        <div
          className="mx-auto flex w-full max-w-screen-xl flex-col gap-4 px-4 pb-24"
          id="container"
        >
          <Navbar />
          <Alerts />
          <Routes>
            {context.isAuthenticated || context.isGuest ? (
              <>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/grades" element={<GradesPage />} />
                <Route path="/create-quiz" element={<CreateQuizPage />} />
                <Route path="/edit-quiz/:quizId" element={<EditQuizPage />} />
                <Route path="/import-quiz" element={<ImportQuizPage />} />
                <Route
                  path="/import-quiz-legacy"
                  element={<ImportQuizLegacyPage />}
                />
                <Route path="/quizzes" element={<QuizzesPage />} />
                <Route
                  path="/search-in-quiz/:quizId"
                  element={<SearchInQuizPage />}
                />
                <Route path="*" element={<Error404Page />} />
              </>
            ) : (
              <>
                <Route path="/login-otp" element={<OTPLoginPage />} />
                <Route path="/login-link/:token" element={<LoginLinkPage />} />
                <Route path="*" element={<LoginPrompt />} />
              </>
            )}
            <Route path="/connect-account" element={<ConnectGuestAccount />} />
            <Route path="/quiz/:quizId" element={<QuizPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          </Routes>
        </div>
        <ToastContainer />
        <footer className="bg-background/60 text-muted-foreground fixed bottom-0 left-0 hidden w-full border-t py-1 text-sm backdrop-blur sm:block">
          <div className="flex items-center justify-center gap-1">
            <span>
              © {new Date().getFullYear()}{" "}
              <a
                className="underline underline-offset-2"
                href="https://github.com/Antoni-Czaplicki"
              >
                Antoni Czaplicki
              </a>
              ,
            </span>
            powered by
            <a
              className="inline-flex items-center gap-1 underline underline-offset-2"
              href="https://solvro.pwr.edu.pl/"
            >
              <AppLogo width={24} /> KN Solvro
            </a>
          </div>
        </footer>
      </ThemeProvider>
    </Router>
  );
}
