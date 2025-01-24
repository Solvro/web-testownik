import React, {useContext, useRef, useState} from 'react';
import {Alert, Button, Card, Col, Form, Row, Spinner} from 'react-bootstrap';
import JSZip from 'jszip';
import AppContext from '../AppContext';
import {useNavigate} from 'react-router';
import QuizPreviewModal from '../components/quiz/QuizPreviewModal';
import {Question, Quiz} from "../components/quiz/types.ts";
import {Icon} from "@iconify/react";

const trueFalseStrings = {
    "prawda": true,
    "tak": true,
    "true": true,
    "fałsz": false,
    "nie": false,
    "false": false
};

const ImportQuizLegacyPage: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [directoryName, setDirectoryName] = useState<string | null>(null);
    const [quizTitle, setQuizTitle] = useState('');
    const [quizDescription, setQuizDescription] = useState('');
    const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);
    const [quiz, setQuiz] = useState<Quiz | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const directoryInputRef = useRef<HTMLInputElement>(null);

    document.title = "Importuj bazę (stara wersja) - Testownik";

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            setDirectoryName(null);
            setDirectoryFiles([]);
        } else {
            setFileName(null);
        }
    };

    const handleDirectorySelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length > 0) {
            const directoryPath = files[0].webkitRelativePath.split('/')[0];
            setDirectoryName(directoryPath);
            setDirectoryFiles(files);
            setFileName(null);
        } else {
            setDirectoryName(null);
        }
    };

    const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files[0];
        if (file) {
            if (fileInputRef.current) {
                fileInputRef.current.files = event.dataTransfer.files;
            }
            setFileName(file.name);
            setDirectoryName(null);
            setDirectoryFiles([]);
        }
    };

    const handleDirectoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const directory = event.dataTransfer.items[0].webkitGetAsEntry() as FileSystemDirectoryEntry;
        if (directory && directory.isDirectory) {
            const reader = directory.createReader();
            const files: File[] = [];
            const readEntries = () => {
                reader.readEntries((entries) => {
                    if (entries.length) {
                        entries.forEach((entry) => {
                            if (entry.isFile) {
                                (entry as FileSystemFileEntry).file((file) => {
                                    files.push(file);
                                });
                            }
                        });
                        readEntries();
                    } else {
                        setDirectoryFiles(files);
                        setDirectoryName(directory.name);
                        setFileName(null);
                    }
                });
            };
            readEntries();
        } else {
            setError('Wybrano niepoprawny folder.');
        }
    };

    const handleDragOverFile = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (
            event.dataTransfer.items &&
            event.dataTransfer.items.length === 1 &&
            event.dataTransfer.items[0].kind === 'file' &&
            ['application/zip', 'application/zip-compressed', 'application/x-zip-compressed', 'multipart/x-zip'].includes(event.dataTransfer.items[0].type)
        ) {
            event.dataTransfer.dropEffect = 'copy';
        } else {
            event.dataTransfer.dropEffect = 'none';
        }
    };

    const handleDragOverDirectory = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (
            event.dataTransfer.items &&
            event.dataTransfer.items.length === 1 &&
            event.dataTransfer.items[0].kind === 'file'
        ) {
            event.dataTransfer.dropEffect = 'copy';
        } else {
            event.dataTransfer.dropEffect = 'none';
        }
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleImport = async () => {
        if (!fileName && !directoryName) {
            setError('Nie wybrano pliku ani folderu.');
            return;
        }

        if (!quizTitle.trim()) {
            setError('Nie podano nazwy bazy.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const questions = await processFiles();

            if (questions.length === 0) {
                setError('Nie znaleziono pytań w wybranych plikach.');
                setLoading(false);
                return;
            }

            const quizData = {
                title: quizTitle,
                description: quizDescription,
                questions,
            }

            const response = await appContext.axiosInstance.post('/quizzes/', quizData);

            if (response.status === 201) {
                const quiz = response.data;
                setQuiz(quiz);
            } else {
                const errorData = await response.data;
                setError(errorData.error || 'Wystąpił błąd podczas importowania quizu.');
            }
        } catch (err) {
            setError(`Wystąpił błąd podczas przetwarzania plików: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    const processFiles = async (): Promise<Question[]> => {
        if (directoryFiles.length > 0) {
            return processDirectory(directoryFiles);
        } else if (fileInputRef.current?.files?.length) {
            return processZip(fileInputRef.current.files[0]);
        } else {
            throw new Error('Nie wybrano pliku ani folderu.');
        }
    };


    async function detectEncodingAndReadFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.result === null) {
                    reject('Error reading file');
                    return;
                }
                try {
                    const decoder = new TextDecoder('utf-8', {fatal: true});
                    // @ts-expect-error: This is necessary to allow reading the result as an ArrayBuffer
                    const content = decoder.decode(reader.result);
                    resolve(content);
                } catch {
                    const decoder = new TextDecoder('windows-1250');
                    // @ts-expect-error: This is necessary to allow reading the result as an ArrayBuffer
                    const content = decoder.decode(reader.result);
                    resolve(content);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    const processDirectory = async (files: File[]): Promise<Question[]> => {
        const questions: Question[] = [];
        let index = 1;
        for (const file of files) {
            if (file.name.endsWith('.txt')) {
                let content;
                try {
                    content = await detectEncodingAndReadFile(file);
                } catch (e) {
                    console.error(`Error reading file ${file.name}: ${e}`);
                    continue;
                }
                const lines = content.split('\n').map((line) => line.trim());
                const question = await parseQuestion(lines, file.name, index++);
                if (question) questions.push(question);
            }
        }
        return questions;
    };

    const processZip = async (file: File): Promise<Question[]> => {
        const questions: Question[] = [];
        const zip = await JSZip.loadAsync(file);
        let index = 1;
        for (const filename of Object.keys(zip.files)) {
            if (filename.endsWith('.txt')) {
                const content = await zip.file(filename)?.async('uint8array');
                let lines;
                try {
                    const decoder = new TextDecoder('utf-8', {fatal: true});
                    lines = decoder.decode(content).split('\n').map(line => line.trim());
                } catch {
                    const decoder = new TextDecoder('windows-1250');
                    lines = decoder.decode(content).split('\n').map(line => line.trim());
                }
                const question = await parseQuestion(lines, filename, index++);
                if (question) questions.push(question);
            }
        }
        return questions;
    };

    const parseQuestion = async (lines: string[], filename: string, index: number): Promise<Question | null> => {
        if (lines.length < 2) {
            console.error(`Error in file ${filename}. Not enough lines. Skipping.`);
            return null;
        }
        const template = lines[0]?.trim();
        const questionLinesCount = template.split('').filter(c => c.toLowerCase() === 'x').length;

        if (!template) {
            console.error(`Error in file ${filename}. Template not found. Skipping.`);
            return null;
        } else if (!["x", "y"].includes(template[0]?.toLowerCase())) {
            console.error(`Error in file ${filename}. Template not recognized. Skipping.`);
            return null;
        } else if ([...template.slice(questionLinesCount)].some(c => c !== '0' && c !== '1')) {
            console.error(`Error in file ${filename}. Template not recognized. Skipping.`);
            return null;
        }

        let question = lines.slice(1, questionLinesCount + 1).join('\n');

        // Extract number from filename
        const filenameNumberMatch = filename.match(/^0*(\\d+)/);
        if (filenameNumberMatch) {
            const filenameNumber = filenameNumberMatch[1];
            // Remove the number from the beginning of the question if it matches the filename number
            const questionNumberMatch = question.match(/^0*(\\d+)\\.\\s*(0*\\d+\\.\\s*)?(.*)/);
            if (questionNumberMatch && questionNumberMatch[1] === filenameNumber) {
                question = questionNumberMatch[3];
            }
        }

        const answers = [];
        for (let s = questionLinesCount + 1; s < Math.min(lines.length, template.length + 1); s++) {
            if (!lines[s] || lines[s]?.trim() === '') {
                continue;
            }
            try {
                answers.push({
                    answer: lines[s]?.trim(),
                    correct: template[s - 1] === '1'
                });
            } catch (error) {
                console.error(`Error in file ${filename} at line ${s}. Replacing the unknown value with False. Error: ${error}`);
                answers.push({
                    answer: lines[s]?.trim(),
                    correct: false
                });
            }
        }

        const isTrueFalse = (template.endsWith("X01") || template.endsWith("X10")) &&
            answers.length === 2 &&
            answers.every(a => a.answer.toLowerCase() in trueFalseStrings);

        return {
            question,
            answers,
            multiple: !isTrueFalse,
            id: index++
        };
    };

    return (
        <>
            <Card className="border-0 shadow p-4">
                <h1 className="h5">Zaimportuj quiz ze starej wersji</h1>
                {error && <Alert variant="danger">{error}</Alert>}

                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group>
                            <Form.Label>Plik zip z pytaniami</Form.Label>
                            <div
                                className="position-relative border rounded p-3 text-center"
                                style={{borderStyle: 'dashed', cursor: 'pointer'}}
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleFileDrop}
                                onDragOver={handleDragOverFile}
                                onDragLeave={handleDragLeave}
                            >
                                <Form.Control
                                    type="file"
                                    accept=".zip"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    style={{display: 'none'}}
                                />
                                {fileName ? (
                                    <>
                                        <Icon icon="material-symbols:folder-zip" style={{fontSize: '2rem'}}/>
                                        <p>{fileName}</p>
                                    </>
                                ) : (
                                    <>
                                        <Icon icon="material-symbols:folder-zip-outline" style={{fontSize: '2rem'}}/>
                                        <p>Wybierz plik...</p>
                                    </>
                                )}
                            </div>
                        </Form.Group>
                    </Col>
                    <Col md={1} className="d-flex justify-content-center align-items-center text-muted">
                        lub
                    </Col>
                    <Col md={5}>
                        <Form.Group>
                            <Form.Label>Folder z pytaniami</Form.Label>
                            <div
                                className="position-relative border rounded p-3 text-center"
                                style={{borderStyle: 'dashed', cursor: 'pointer'}}
                                onClick={() => directoryInputRef.current?.click()}
                                onDrop={handleDirectoryDrop}
                                onDragOver={handleDragOverDirectory}
                                onDragLeave={handleDragLeave}
                            >
                                <Form.Control
                                    type="file"
                                    ref={directoryInputRef}
                                    /* @ts-expect-error: This is necessary to allow directory selection in the file input */
                                    directory=""
                                    webkitdirectory=""
                                    onChange={handleDirectorySelect}
                                    style={{display: 'none'}}
                                />
                                {directoryName ? (
                                    <>
                                        <Icon icon="material-symbols:folder" style={{fontSize: '2rem'}}/>
                                        <p>{directoryName}</p>
                                    </>
                                ) : (
                                    <>
                                        <Icon icon="material-symbols:folder-outline" style={{fontSize: '2rem'}}/>
                                        <p>Wybierz folder...</p>
                                    </>
                                )}
                            </div>
                        </Form.Group>
                    </Col>
                </Row>

                <Form.Group className="mb-3">
                    <Form.Label>Nazwa</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Nazwa bazy"
                        value={quizTitle}
                        onChange={(e) => setQuizTitle(e.target.value)}
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Opis</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Dodatkowy opis"
                        value={quizDescription}
                        onChange={(e) => setQuizDescription(e.target.value)}
                    />
                </Form.Group>

                <div className="text-center">
                    <Button
                        variant={appContext.theme.getOppositeTheme()}
                        onClick={handleImport}
                        disabled={loading}
                    >
                        {loading ? <Spinner animation="border" size="sm"/> : 'Importuj'}
                    </Button>
                </div>
            </Card>

            <QuizPreviewModal
                show={quiz !== null}
                onHide={() => navigate('/')}
                quiz={quiz}
                type="imported"
            />
        </>
    );
};

export default ImportQuizLegacyPage;