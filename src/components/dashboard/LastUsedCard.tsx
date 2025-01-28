import React, {useContext, useEffect, useState} from "react";
import {Card, Table} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import {Link} from "react-router";

interface Quiz {
    id: number;
    title: string;
}

const LastUsedCard: React.FC = () => {
    const appContext = useContext(AppContext);
    const [lastUsedQuizzes, setLastUsedQuizzes] = useState<Quiz[]>([]);

    useEffect(() => {
        fetchLastUsedQuizzes();
    }, []);

    const fetchLastUsedQuizzes = async () => {
        try {
            const response = await appContext.axiosInstance.get("/last-used-quizzes/");
            const data: Quiz[] = response.data;
            setLastUsedQuizzes(data);
        } catch {
            setLastUsedQuizzes([]);
        }
    };

    return (
        <Card className="border-0 shadow flex-fill">
            <Card.Body>
                <h5 className="card-title mb-3">Ostatnio używane</h5>
                <div style={{overflowY: "auto", maxHeight: "11.25rem"}}>
                    <Table>
                        <tbody>
                        {lastUsedQuizzes.length > 0 ? (
                            lastUsedQuizzes.map((quiz) => (
                                <tr key={quiz.id}>
                                    <td>
                                        <Link to={`/quiz/${quiz.id}`}
                                              className={"text-decoration-none text-" + appContext.theme.getOppositeTheme()}>
                                            {quiz.title}
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td className="text-muted">Brak ostatnio używanych quizów.</td>
                            </tr>
                        )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

export default LastUsedCard;