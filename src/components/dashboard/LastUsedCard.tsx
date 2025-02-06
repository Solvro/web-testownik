import React, {useContext, useEffect, useState} from "react";
import {Button, Card, Table} from "react-bootstrap";
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
        fetchLastUsedQuizzes(4);
    }, []);

    const fetchLastUsedQuizzes = async (limit: number) => {
        try {
            if (appContext.isGuest) {
                const guestQuizzes = localStorage.getItem("guest_quizzes");
                setLastUsedQuizzes(guestQuizzes ? JSON.parse(guestQuizzes).slice(0, limit) : []);
                return;
            }
            const response = await appContext.axiosInstance.get("/last-used-quizzes/", {
                params: {limit: limit},
            });
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
                <div style={{overflowY: "auto", maxHeight: lastUsedQuizzes.length > 4 ? "16rem" : "11.25rem"}}>
                    <Table>
                        <tbody>
                        {lastUsedQuizzes.length > 0 ? (
                            <>
                                {lastUsedQuizzes.map((quiz) => (
                                    <tr key={quiz.id}>
                                        <td>
                                            <Link to={`/quiz/${quiz.id}`}
                                                  className={"text-decoration-none text-" + appContext.theme.getOppositeTheme()}>
                                                {quiz.title}
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {lastUsedQuizzes.length === 4 && (
                                    <tr>
                                        <td className="text-center">
                                            <Button variant="link" className="text-decoration-none text-muted p-0"
                                                    onClick={() => fetchLastUsedQuizzes(10)}>
                                                Pokaż więcej
                                            </Button>
                                        </td>
                                    </tr>
                                )}
                            </>
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