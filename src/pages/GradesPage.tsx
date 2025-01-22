import React, {useState, useEffect, useContext, useCallback} from "react";
import AppContext from "../AppContext.tsx";
import {Alert, Button, Card, Form, Navbar, Table} from "react-bootstrap";
import PropagateLoader from "react-spinners/PropagateLoader";
import {Icon} from "@iconify/react";

interface Grade {
    value: number;
    value_symbol: string;
    counts_into_average: boolean;
}

interface Course {
    course_id: string;
    course_name: string;
    ects: number;
    grades: Grade[];
    term_id: string;
    passing_status: "passed" | "failed" | "not_yet_passed";
}

interface Term {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
}

interface GradesData {
    courses: Course[];
    terms: Term[];
}

const GradesPage: React.FC = () => {
    const appContext = useContext(AppContext);


    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [selectedTerm, setSelectedTerm] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [editedGrades, setEditedGrades] = useState<Record<string, number | string>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await appContext.axiosInstance.get('/grades/')
                if (response.status !== 200) {
                    throw new Error("Invalid response status");
                }
                const data: GradesData = response.data;
                setTerms(data.terms);
                setCourses(data.courses);
                setSelectedTerm(
                    data.terms.find(
                        (term) =>
                            new Date() >= new Date(term.start_date) &&
                            new Date() <= new Date(term.end_date)
                    )?.id || ""
                );
                setError(null);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching grades:", error);
                setError(error instanceof Error ? error.message : "Wystąpił błąd podczas pobierania ocen.");
            }
        };

        fetchData();
    }, [appContext.axiosInstance]);

    useEffect(() => {
        if (!editing) {
            setEditedGrades({});
        }
    }, [editing]);

    const calculateAverage = useCallback((filteredCourses: Course[]) => {
        const sum = filteredCourses.reduce((acc, course) => {
            const courseSum = course.grades.reduce(
                (courseAcc, grade) => {
                    const gradeValue = editedGrades[course.course_id] ?? grade.value;
                    if (typeof gradeValue === "string") {
                        return courseAcc;
                    }
                    return courseAcc + (grade.counts_into_average ? gradeValue * course.ects : 0);
                },
                0
            ) + (editing && typeof editedGrades[course.course_id] === "number" && course.grades.length === 0 ? (editedGrades[course.course_id] as number) * course.ects : 0);
            return acc + courseSum;
        }, 0);

        const totalWeight = filteredCourses.reduce((acc, course) => {
            const courseWeight = course.grades.reduce(
                (courseAcc, grade) =>
                    courseAcc + (grade.counts_into_average ? course.ects : 0),
                0
            ) + (editing && typeof editedGrades[course.course_id] === "number" && course.grades.length === 0 ? course.ects : 0);
            return acc + courseWeight;
        }, 0);

        if (totalWeight === 0) {
            return "-";
        }

        return (sum / totalWeight).toFixed(2);
    }, [editedGrades, editing]);

    const filteredCourses = selectedTerm
        ? courses.filter((course) => course.term_id === selectedTerm)
        : courses;


    if (loading) {
        return (
            <Card className="shadow border-0">
                <Card.Body>
                    <div className="text-center mb-5">
                        <p>Ładowanie ocen...</p>
                        <PropagateLoader color={appContext.theme.getOppositeThemeColor()} size={15}/>
                    </div>
                    {error && (
                        <Alert variant="danger">
                            <p>Wystąpił błąd podczas pobierania ocen.</p>
                            <p>{error}</p>
                            <Button
                                variant="link"
                                className="alert-link p-0"
                                onClick={() => window.location.reload()}
                            >
                                Spróbuj ponownie
                            </Button>
                        </Alert>
                    )}
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card className="p-4 shadow border-0">
            <Navbar className="mb-4 justify-content-between align-items-end">
                <Form.Group>
                    <Form.Label htmlFor="term-select" className="me-2 mb-0">
                        Wybierz semestr
                    </Form.Label>
                    <Form.Select
                        id="term-select"
                        aria-label="Wybierz semestr"
                        disabled={!terms.length}
                        value={selectedTerm}
                        onChange={(e) => {
                            setSelectedTerm(e.target.value);
                            setEditing(false);
                        }}
                    >
                        {terms.map((term) => (
                            <option key={term.id} value={term.id}>
                                {term.name}
                            </option>
                        ))}
                    </Form.Select>
                </Form.Group>
                <Button
                    variant={editing ? "warning" : appContext.theme.getTheme()}
                    size="sm"
                    onClick={() => setEditing((prev) => !prev)}
                >
                    <Icon icon={editing ? "fluent:text-edit-style-24-filled" : "fluent:text-edit-style-24-regular"}
                          fontSize="1.5em"/>
                </Button>
            </Navbar>
            {error && (
                <Alert variant="danger">
                    <p>Wystąpił błąd podczas pobierania ocen.</p>
                    <p>{error}</p>
                    <Button
                        variant="link"
                        className="alert-link p-0"
                        onClick={() => window.location.reload()}
                    >
                        Spróbuj ponownie
                    </Button>
                </Alert>
            )}
            <Table hover responsive>
                <thead>
                <tr>
                    <th>Przedmiot</th>
                    <th>ECTS</th>
                    <th>Ocena</th>
                </tr>
                </thead>
                <tfoot>
                <tr>
                    <th>Średnia</th>
                    <th></th>
                    <th id="average">{calculateAverage(filteredCourses) || "-"}</th>
                </tr>
                </tfoot>
                <tbody>
                {filteredCourses.map((course) => (
                    <tr key={course.course_id}>
                        <td>{course.course_name}</td>
                        <td>{course.ects}</td>
                        <td
                            className={
                                course.passing_status === "passed"
                                    ? "text-success"
                                    : course.passing_status === "failed"
                                        ? "text-danger"
                                        : ""
                            }
                        >
                            {editing ? (
                                <Form.Control
                                    type="number"
                                    step="0.5"
                                    min="2"
                                    max="5.5"
                                    size="sm"
                                    value={editedGrades[course.course_id] !== undefined ? editedGrades[course.course_id] : course.grades.map((grade) => grade.value).join("; ")}
                                    onChange={(e) =>
                                        setEditedGrades((prev) => ({
                                            ...prev,
                                            [course.course_id]: parseFloat(e.target.value) || e.target.value
                                        }))
                                    }
                                />
                            ) : course.grades.map((grade) => grade.value_symbol).join("; ") || "-"}
                        </td>
                    </tr>
                ))}
                </tbody>
            </Table>
        </Card>
    );
}

export default GradesPage;
