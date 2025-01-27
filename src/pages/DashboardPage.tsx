import React from "react";
import {Row, Col} from "react-bootstrap";
import QuestionQuizCard from "../components/dashboard/QuestionQuizCard.tsx";
import LastUsedCard from "../components/dashboard/LastUsedCard.tsx";
import AboutCard from "../components/dashboard/AboutCard.tsx";
import SearchCard from "../components/dashboard/SearchCard.tsx";
import ImportButtonsCard from "../components/dashboard/ImportButtonsCard.tsx";
import '../styles/dashboard.css';

const DashboardPage: React.FC = () => {

    document.title = "Testownik Solvro";

    return (
        <Row className="mh-1 row-gap-3">
            {/* Dev */}

            {/* Left Column */}
            <Col md={4} className="d-flex flex-column gap-3 order-1 order-md-0">
                <QuestionQuizCard/>
            </Col>

            {/* Middle Column */}
            <Col md={4} className="d-flex flex-column gap-3 order-0 order-md-1">
                <LastUsedCard/>
                <ImportButtonsCard/>
            </Col>

            {/* Right Column */}
            <Col md={4} className="d-flex flex-column gap-3 order-2">
                <SearchCard/>
                <AboutCard/>
            </Col>
        </Row>
    );
};

export default DashboardPage;