import React, {useContext, useRef, useState} from 'react';
import {Alert, Button, ButtonGroup, Card, Form, Modal, Spinner} from 'react-bootstrap';
import {Icon} from "@iconify/react";
import AppContext from "../AppContext.tsx";
import {Quiz} from "../components/quiz/types.ts";
import QuizPreviewModal from "../components/quiz/QuizPreviewModal.tsx";
import {useNavigate} from "react-router";
import {validateQuiz} from "../components/quiz/helpers/quizValidation.ts";
import {toast} from "react-toastify";
import {uuidv4} from "../components/quiz/helpers/uuid.ts";

type UploadType = 'file' | 'link' | 'json';

const ImportQuizPage: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const [uploadType, setUploadType] = useState<UploadType>('link');
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [quiz, setQuiz] = useState<Quiz | null>(null);

    const [showJsonFormatModal, setShowJsonFormatModal] = useState(false);

    document.title = "Importuj quiz - Testownik Solvro";

    const handleUploadTypeChange = (type: UploadType) => {
        setUploadType(type);
        setError(null);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            setError(null);
        } else {
            setFileName(null);
        }
    };

    const setErrorAndNotify = (message: string) => {
        setError(message);
        toast.error(message);
        setLoading(false);
    }

    const addQuestionIdsIfMissing = (quiz: Quiz): Quiz => {
        let id = 1;
        for (const question of quiz.questions) {
            if (!question.id) {
                question.id = id++;
            } else {
                id = Math.max(id, question.id + 1);
            }
        }
        return quiz;
    }

    const handleImport = async () => {
        setError(null);
        setLoading(true);
        if (uploadType === 'file') {
            const file = fileInputRef.current?.files?.[0];
            if (!file) {
                setErrorAndNotify('Wybierz plik z quizem.');
                return;
            }
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const data = JSON.parse(reader.result as string);
                    const validationError = validateQuiz(addQuestionIdsIfMissing(data));
                    if (validationError) {
                        setErrorAndNotify(validationError);
                        return false;
                    }
                    await submitImport('json', data);
                } catch (error) {
                    if (error instanceof Error) {
                        setError(`Wystąpił błąd podczas wczytywania pliku: ${error.message}`);
                    } else {
                        setError('Wystąpił błąd podczas wczytywania pliku.');
                    }
                    console.error('Błąd podczas wczytywania pliku:', error);
                }
            };
            reader.readAsText(file);
        } else if (uploadType === 'link') {
            const linkInput = (document.getElementById('link-input') as HTMLInputElement)?.value;
            if (!linkInput) {
                setErrorAndNotify('Wklej link do quizu.');
                setLoading(false);
                return;
            }
            try {
                new URL(linkInput);
                await submitImport('link', linkInput);
            } catch {
                setError('Link jest niepoprawny.');
            }
        } else if (uploadType === 'json') {
            const textInput = (document.getElementById('text-input') as HTMLTextAreaElement)?.value;
            if (!textInput) {
                setError('Wklej quiz w formie tekstu.');
                setLoading(false);
                return;
            }
            try {
                const data = JSON.parse(textInput);
                const validationError = validateQuiz(addQuestionIdsIfMissing(data));
                if (validationError) {
                    setErrorAndNotify(validationError);
                    return false;
                }
                await submitImport('json', data);
            } catch (error) {
                if (error instanceof Error) {
                    setError(`Wystąpił błąd podczas parsowania JSON: ${error.message}`);
                } else {
                    setError('Quiz jest niepoprawny. Upewnij się, że jest w formacie JSON.');
                }
                console.error('Błąd podczas parsowania JSON:', error);
            }
        }
        setLoading(false);
    };

    const submitImport = async (type: 'json' | 'link', data: string | Quiz) => {
        try {
            if (appContext.isGuest) {
                if (type === 'link' || typeof data === 'string') {
                    try {
                        const response = await fetch(data as string);
                        data = await response.json() as Quiz;
                    } catch {
                        setError('Wystąpił błąd podczas importowania quizu, będąc gościem możesz tylko importować quizy z domeny testownik.solvro.pl, które są dostępne publicznie. Ciągle możesz skorzystać z opcji importu z pliku lub wprowadzić quiz ręcznie.');
                        return;
                    }
                }
                const tempQuiz = {
                    ...data,
                    id: uuidv4(),
                    visibility: 0,
                    version: 1,
                    allow_anonymous: false,
                    is_anonymous: true,
                    can_edit: true,
                }
                const userQuizzes = localStorage.getItem('guest_quizzes') ? JSON.parse(localStorage.getItem('guest_quizzes')!) : []
                userQuizzes.push(tempQuiz)
                localStorage.setItem('guest_quizzes', JSON.stringify(userQuizzes))
                setQuiz(tempQuiz);
                return;
            }
            let response;
            if (type === 'json') {
                response = await appContext.axiosInstance.post('/quizzes/', data);
            } else if (type === 'link') {
                response = await appContext.axiosInstance.post('/import-quiz-from-link/', {link: data});
            } else {
                return;
            }

            if (response.status === 201) {
                const result = await response.data;
                setQuiz(result);
            } else {
                const errorData = await response.data;
                setError(errorData.error || 'Wystąpił błąd podczas importowania quizu.');
            }
        } catch {
            setError('Wystąpił błąd podczas importowania quizu.');
        }
    };

    return (
        <>
            <Card className="border-0 shadow">
                <Card.Body>
                    <h1 className="h5">Zaimportuj quiz</h1>
                    {error && <Alert variant="danger">{error}</Alert>}

                    <ButtonGroup className="d-flex justify-content-center my-3">
                        <Button
                            variant={uploadType === 'file' ? `${appContext.theme.getOppositeTheme()}` : `outline-${appContext.theme.getOppositeTheme()}`}
                            onClick={() => handleUploadTypeChange('file')}
                            className={"flex-grow-0"}
                        >
                            Z pliku
                        </Button>
                        <Button
                            variant={uploadType === 'link' ? `${appContext.theme.getOppositeTheme()}` : `outline-${appContext.theme.getOppositeTheme()}`}
                            onClick={() => handleUploadTypeChange('link')}
                            className={"flex-grow-0"}
                        >
                            Z linku
                        </Button>
                        <Button
                            variant={uploadType === 'json' ? `${appContext.theme.getOppositeTheme()}` : `outline-${appContext.theme.getOppositeTheme()}`}
                            onClick={() => handleUploadTypeChange('json')}
                            className={"flex-grow-0"}
                        >
                            Z tekstu
                        </Button>
                    </ButtonGroup>

                    {uploadType === 'file' && (
                        <div>
                            <Form.Group>
                                <Form.Label>Plik z quizem</Form.Label>
                                <div
                                    className="position-relative border rounded p-3 text-center"
                                    style={{borderStyle: 'dashed', cursor: 'pointer'}}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Form.Control
                                        type="file"
                                        accept=".json"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        style={{display: 'none'}}
                                    />
                                    {fileName ? (
                                        <>
                                            <Icon icon={"lucide:file-json"} style={{fontSize: "2rem"}}/>
                                            <p className="mt-2 mb-0">Wybrano plik:</p>
                                            <span className="badge bg-secondary">{fileName}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icon icon={"bi:file-earmark-arrow-up"} style={{fontSize: "2rem"}}/>
                                            <p className="mt-2 mb-0">Wybierz plik...</p>
                                        </>
                                    )}
                                </div>
                            </Form.Group>
                        </div>
                    )}

                    {uploadType === 'link' && (
                        <Form.Group>
                            <Form.Label>Link do quizu</Form.Label>
                            <Form.Control type="text" placeholder="Wklej link do quizu" id="link-input"/>
                        </Form.Group>
                    )}

                    {uploadType === 'json' && (
                        <Form.Group>
                            <Form.Label>Quiz w formie tekstu</Form.Label>
                            <Form.Control as="textarea" rows={5} placeholder="Wklej quiz w formie tekstu"
                                          id="text-input"/>
                        </Form.Group>
                    )}

                    <div className="d-flex justify-content-center mt-3">
                        <Button onClick={handleImport} variant={appContext.theme.getOppositeTheme()} disabled={loading}>
                            {loading ? (
                                <>
                                    <Spinner animation="border" role="status" size="sm">
                                        <span className="visually-hidden">Loading...</span>
                                    </Spinner>
                                    <span className="ms-2">Importowanie...</span>
                                </>
                            ) : (
                                "Zaimportuj"
                            )}
                        </Button>
                    </div>
                </Card.Body>
            </Card>
            <QuizPreviewModal show={quiz !== null} onHide={() => navigate("/")} quiz={quiz} type="imported"/>
            <p className="text-center mt-3">
                <a href="#" className="fs-6 link-secondary" onClick={() => setShowJsonFormatModal(true)}>
                    Jak powinien wyglądać quiz w formacie JSON?
                </a>
            </p>
            <Modal
                show={showJsonFormatModal}
                onHide={() => setShowJsonFormatModal(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>Format JSON quizu</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        Quiz w formacie JSON powinien składać się z dwóch głównych
                        kluczy: <code>title</code> i <code>questions</code>.
                    </p>
                    <p>
                        Klucz <code>title</code> powinien zawierać tytuł quizu w formie tekstu.
                    </p>
                    <p>
                        Klucz <code>questions</code> powinien zawierać tablicę obiektów reprezentujących pytania.
                        Każde pytanie powinno zawierać
                        klucze <code>id</code>, <code>question</code> i <code>answers</code> oraz
                        opcjonalnie <code>multiple</code> (domyślnie <code>false</code>) i <code>explanation</code>.
                        Jeśli nie podano <code>id</code>, zostanie on nadany automatycznie od 1.
                    </p>
                    <p>
                        Przykładowy quiz w formacie JSON:
                    </p>
                    <pre className="overflow-auto" style={{maxHeight: "50vh"}}>
                        {`{
    "title": "Przykładowy quiz",
    "description": "Opis quizu", // Opcjonalny
    "questions": [
        {
            "id": 1,
            "question": "Jaki jest sens sesji?",
            "answers": [
                {
                    "answer": "Nie ma sensu",
                    "correct": false
                },
                {
                    "answer": "Żeby zjeść obiad",
                    "correct": true
                },
                {
                    "answer": "Żeby się wykończyć",
                    "correct": false
                }
            ],
            "multiple": false, // Opcjonalny, domyślnie false
            "explanation": "Sesja ma sens, żeby zjeść obiad." // Opcjonalny, domyślnie null
        },
        {
            "id": 2,
            "question": "Kto jest najlepszy?",
            "answers": [
                {
                    "answer": "Ja",
                    "correct": true
                },
                {
                    "answer": "Ty",
                    "correct": false
                }
            ],
            "multiple": false
        },
        {
            "id": 3,
            "question": "Pytanie ze zdjęciem",
            "image": "https://example.com/image.jpg", // Opcjonalny
            "answers": [
                {
                    "answer": "Odpowiedź 1",
                    "image": "https://example.com/image2.jpg", // Opcjonalny
                    "correct": true
                },
                {
                    "answer": "Odpowiedź 2",
                    "image": "https://example.com/image3.jpg", // Opcjonalny
                    "correct": false
                }
            ],
            "multiple": true
        }
    ]
}`}
                    </pre>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default ImportQuizPage;
