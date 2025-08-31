import React, { useContext } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router";
import DashboardPage from "./pages/DashboardPage.tsx";
import Navbar from "./components/Navbar.tsx";
import AppContext from "./AppContext.tsx";
import LoginPrompt from "./components/LoginPrompt.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import Error404Page from "./pages/errors/Error404Page.tsx";
import GradesPage from "./pages/GradesPage.tsx";
import QuizPage from "./pages/QuizPage.tsx";
import ImportQuizPage from "./pages/ImportQuizPage.tsx";
import ImportQuizLegacyPage from "./pages/ImportQuizLegacyPage.tsx";
import CreateQuizPage from "./pages/CreateQuizPage.tsx";
import EditQuizPage from "./pages/EditQuizPage.tsx";
import QuizzesPage from "./pages/QuizzesPage.tsx";
import SearchInQuizPage from "./pages/SearchInQuizPage.tsx";
import TermsPage from "./pages/TermsPage.tsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.tsx";
import Alerts from "./components/Alerts.tsx";
import ConnectGuestAccount from "./components/ConnectGuestAccount.tsx";
import LoginLinkPage from "./pages/LoginLinkPage.tsx";
import OTPLoginPage from "./pages/OTPLoginPage.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import AppLogo from "@/components/app-logo.tsx";
import ToastContainer from "@/components/toast-container.tsx";

const App: React.FC = () => {
  const context = useContext(AppContext);

  return (
    <>
      <Router>
        <ThemeProvider storageKey="vite-ui-theme">
          <div
            className="mx-auto flex w-full max-w-screen-xl flex-col gap-4 px-4 pb-24"
            id="container"
          >
            <Navbar />
            <Alerts />
            <Routes>
              {((context.isAuthenticated || context.isGuest) && (
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
              )) || (
                <>
                  <Route path="/login-otp" element={<OTPLoginPage />} />
                  <Route
                    path="/login-link/:token"
                    element={<LoginLinkPage />}
                  />
                  <Route path="*" element={<LoginPrompt />} />
                </>
              )}
              {context.isGuest && (
                <Route
                  path="/connect-account"
                  element={<ConnectGuestAccount />}
                />
              )}
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
    </>
  );
};

export default App;
