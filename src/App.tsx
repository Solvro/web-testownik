import React, {useContext, useEffect, useState} from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router';
import DashboardPage from './pages/DashboardPage.tsx';
import Navbar from "./components/Navbar.tsx";
import AppContext from "./AppContext.tsx";
import {Theme} from "./Theme.tsx";
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
import {ToastContainer} from "react-toastify";
import Alerts from "./components/Alerts.tsx";
import ConnectGuestAccount from "./components/ConnectGuestAccount.tsx";
import LoginLinkPage from "./pages/LoginLinkPage.tsx";
import OTPLoginPage from "./pages/OTPLoginPage.tsx";
import './styles/App.css';

const useThemeDetector = () => {
    const getCurrentTheme = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
    const [theme, setTheme] = useState(getCurrentTheme() ? Theme.DARK : Theme.LIGHT);
    const mqListener = (e: { matches: boolean }) => {
        setTheme(e.matches ? Theme.DARK : Theme.LIGHT);
    };

    useEffect(() => {
        const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)");
        darkThemeMq.addEventListener("change", mqListener);
        return () => darkThemeMq.removeEventListener("change", mqListener);
    }, [theme]);
    return theme;
};

const App: React.FC = () => {
    const context = useContext(AppContext);

    context.theme.setTheme(useThemeDetector());

    return (
        <>
            <Router>
                <div className="container d-flex flex-column mb-5" id="container">
                    <Navbar/>
                    <Alerts/>
                    <Routes>
                        {(context.isAuthenticated || context.isGuest) && (
                            <>
                                <Route path="/" element={<DashboardPage/>}/>
                                <Route path="/profile" element={<ProfilePage/>}/>
                                <Route path="/grades" element={<GradesPage/>}/>
                                <Route path="/create-quiz" element={<CreateQuizPage/>}/>
                                <Route path="/edit-quiz/:quizId" element={<EditQuizPage/>}/>
                                <Route path="/import-quiz" element={<ImportQuizPage/>}/>
                                <Route path="/import-quiz-legacy" element={<ImportQuizLegacyPage/>}/>
                                <Route path="/quizzes" element={<QuizzesPage/>}/>
                                <Route path="/search-in-quiz/:quizId" element={<SearchInQuizPage/>}/>
                                <Route path="*" element={<Error404Page/>}/>
                            </>
                        ) || (
                            <>
                                <Route path="/login-otp" element={<OTPLoginPage/>}/>
                                <Route path="/login-link/:token" element={<LoginLinkPage/>}/>
                                <Route path="*" element={<LoginPrompt/>}/>
                            </>
                        )}
                        {context.isGuest && (
                            <Route path="/connect-account" element={<ConnectGuestAccount/>}/>
                        )}
                        <Route path="/quiz/:quizId" element={<QuizPage/>}/>
                        <Route path="/terms" element={<TermsPage/>}/>
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage/>}/>
                    </Routes>
                </div>
                <ToastContainer theme={context.theme.getTheme()} newestOnTop={false} pauseOnFocusLoss
                                position="bottom-right" draggable={true}/>
                <footer className={`footer text-center py-1 d-none d-sm-block bg-${context.theme.getTheme()}`}
                        style={{position: "fixed", bottom: 0, width: "100%"}}>
                <span>© {new Date().getFullYear()} <a href="https://github.com/Antoni-Czaplicki">Antoni Czaplicki</a>, powered by <a
                    href="https://solvro.pwr.edu.pl/"><img src="/solvro_mono.svg" alt="solvro logo" width={24}
                                                           className="solvro-logo"/> KN Solvro</a> </span>
                </footer>
            </Router>
        </>
    );
};

export default App;