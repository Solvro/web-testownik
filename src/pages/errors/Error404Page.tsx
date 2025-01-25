import React from "react";
import {Card} from "react-bootstrap";

const Error404Page: React.FC = () => {

    document.title = "404 - Testownik";

    return (
        <Card className="border-0 shadow">
            <Card.Body className="text-center">
                <h1>404</h1>
                <h2>Strona nie znaleziona</h2>

                <p className="text-muted">Jeśli uważasz, że to błąd, możesz utworzyć zgłoszenie na <a
                    href="https://github.com/solvro/web-testownik/issues" target="_blank"
                    rel="noreferrer">GitHubie</a>.</p>
            </Card.Body>

        </Card>
    );
};

export default Error404Page;