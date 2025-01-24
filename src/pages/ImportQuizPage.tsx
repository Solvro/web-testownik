import React, {useState, useRef, useContext} from 'react';
import {Button, Card, Alert, Form, ButtonGroup, Spinner} from 'react-bootstrap';
import {Icon} from "@iconify/react";
import AppContext from "../AppContext.tsx";
import {Quiz} from "../components/quiz/types.ts";
import QuizPreviewModal from "../components/quiz/QuizPreviewModal.tsx";
import {useNavigate} from "react-router";

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

    document.title = "Importuj bazę - Testownik";

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

    const handleImport = async () => {
        setError(null);
        setLoading(true);
        if (uploadType === 'file') {
            const file = fileInputRef.current?.files?.[0];
            if (!file) {
                setError('Wybierz plik z quizem.');
                setLoading(false);
                return;
            }
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const data = JSON.parse(reader.result as string);
                    await submitImport('json', data);
                } catch {
                    setError('Wystąpił błąd podczas wczytywania pliku.');
                }
            };
            reader.readAsText(file);
        } else if (uploadType === 'link') {
            const linkInput = (document.getElementById('link-input') as HTMLInputElement)?.value;
            if (!linkInput) {
                setError('Wklej link do quizu.');
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
                await submitImport('json', data);
            } catch {
                setError('Quiz jest niepoprawny. Upewnij się, że jest w formacie JSON.');
            }
        }
        setLoading(false);
    };

    const submitImport = async (type: 'json' | 'link', data: string | Quiz) => {
        try {
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
        </>
    );
};

export default ImportQuizPage;
