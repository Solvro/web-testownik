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
            <div className="container d-flex flex-column" id="container">
                <Router>
                    <Navbar/>
                    <Routes>
                        {context.isAuthenticated && (
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
                                <Route path="*" element={<LoginPrompt/>}/>
                            </>
                        )}
                        <Route path="/quiz/:quizId" element={<QuizPage/>}/>
                        <Route path="/terms" element={<TermsPage/>}/>
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage/>}/>
                    </Routes>
                </Router>
            </div>
            <footer className={`footer text-center py-1 d-none d-sm-block bg-${context.theme.getTheme()}`}
                    style={{position: "fixed", bottom: 0, width: "100%"}}>
                <span>© {new Date().getFullYear()} <a href="https://github.com/Antoni-Czaplicki">Antoni Czaplicki</a>, powered by <a
                    href="https://solvro.pwr.edu.pl/">Solvro</a></span>
            </footer>
        </>
    );
};

export default App;