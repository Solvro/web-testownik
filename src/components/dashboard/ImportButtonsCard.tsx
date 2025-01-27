import React from "react";
import {Card, Button} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import {Link} from "react-router";

const ImportButtonsCard: React.FC = () => {
    const appContext = React.useContext(AppContext);

    return (
        <Card className="border-0 shadow flex-fill">
            <Card.Body className="d-flex align-items-center">
                <div className="row gap-3 p-2 justify-content-center">
                    <Link to="/create-quiz" className="w-auto">
                        <Button className="w-auto" variant={`outline-${appContext.theme.getOppositeTheme()}`}>Dodaj nową
                            bazę</Button>
                    </Link>
                    <Link to="/import-quiz" className="w-auto">
                        <Button variant={`outline-${appContext.theme.getOppositeTheme()}`}>Importuj
                            bazę</Button>
                    </Link>
                    <Link to="/import-quiz-legacy" className="w-auto">
                        <Button className="w-auto" variant={`outline-${appContext.theme.getOppositeTheme()}`}>Importuj
                            bazę (stara wersja)</Button>
                    </Link>
                </div>
            </Card.Body>
        </Card>
    );
};

export default ImportButtonsCard;