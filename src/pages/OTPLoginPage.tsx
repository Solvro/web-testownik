import {Alert, Button, Card, Form} from 'react-bootstrap';
import React, {useCallback, useContext, useState} from "react";
import AppContext from "../AppContext.tsx";
import axios, {AxiosError} from "axios";
import {SERVER_URL} from "../config.ts";
import OtpInput from 'react-otp-input';
import {useNavigate} from "react-router";


const OTPLoginPage = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState<string>("");
    const [otp, setOtp] = useState<string>("");

    document.title = "Logowanie OTP - Testownik Solvro";

    const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const response = await axios.post(`${SERVER_URL}/generate-otp/`, {email})
            if (response.status === 200) {
                setSubmitted(true);
                setError(null);
            } else {
                setError(response.statusText);
            }
        } catch (error) {
            if ((error as AxiosError)?.response?.status === 404) {
                setError("Nie znaleziono użytkownika o podanym adresie e-mail.");
            } else {
                setError(((error as AxiosError)?.response?.data as {
                    error?: string
                })?.error || "Niezidentyfikowany błąd.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const handleOTPSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const response = await axios.post(`${SERVER_URL}/login-otp/`, {email: email.trim(), otp: otp});
            if (response.status === 200) {
                localStorage.setItem('access_token', response.data.access_token);
                localStorage.setItem('refresh_token', response.data.refresh_token);
                await appContext.fetchUserData();
                appContext.setAuthenticated(true);
                appContext.setGuest(false);
                navigate("/");
            } else {
                setError(response.statusText);
            }
        } catch (error) {
            setError(((error as AxiosError)?.response?.data as {
                error?: string
            })?.error || "Niezidentyfikowany błąd.");
        } finally {
            setSubmitting(false);
        }
    }, [email, otp]);

    if (submitted) {
        return (
            <div className="d-flex justify-content-center">
                <Card className="min-w-50 shadow border-0">
                    <Card.Body>
                        <div className="text-center">
                            <Card.Title>Kod jednorazowy został wysłany na Twój adres e-mail</Card.Title>
                            <Form onSubmit={handleOTPSubmit}>
                                <Form.Label>Wprowadź kod jednorazowy</Form.Label>
                                <OtpInput
                                    value={otp}
                                    onChange={setOtp}
                                    numInputs={6}
                                    containerStyle="justify-content-center gap-2"
                                    inputStyle={{width: "3rem", height: "4rem", padding: "0.5rem", fontSize: "2rem"}}
                                    shouldAutoFocus={true}
                                    // @ts-expect-error - value can be a readonly string[]
                                    renderInput={(props) => <Form.Control {...props} />}
                                />
                                <Button variant="primary" type="submit" className="mt-2" disabled={submitting}>
                                    {submitting ? "Logowanie..." : "Zaloguj się"}
                                </Button>
                            </Form>
                        </div>
                        {error && (
                            <Alert variant="danger" className="mt-3">
                                <p>Wystąpił błąd podczas logowania za pomocą kodu jednorazowego.</p>
                                <p>{error}</p>
                                <Button
                                    variant="link"
                                    className="alert-link p-0"
                                    onClick={() => {
                                        setSubmitted(false);
                                        setError(null);
                                        setOtp("");
                                    }}
                                >
                                    Wyślij ponownie kod
                                </Button>
                            </Alert>
                        )}
                    </Card.Body>
                </Card>
            </div>
        );
    }

    return (
        <div className="d-flex justify-content-center">
            <Card className="min-w-50 shadow border-0">
                <Card.Body>
                    <Card.Title>Zaloguj się za pomocą adresu e-mail</Card.Title>
                    <Card.Text>
                        Na Twój adres e-mail zostanie wysłany kod jednorazowy.
                    </Card.Text>
                    <Form onSubmit={handleEmailSubmit}>
                        <Form.Label>E-mail</Form.Label>
                        <Form.Control type="email" placeholder="E-mail" value={email}
                                      onChange={(e) => setEmail(e.target.value)} required/>
                        <Button variant="primary" type="submit" className="mt-2" disabled={submitting}>
                            {submitting ? "Wysyłanie..." : "Wyślij kod"}
                        </Button>
                    </Form>
                    {error && (
                        <Alert variant="danger" className="mt-3">
                            <p>Wystąpił błąd podczas wysyłania kodu.</p>
                            <p>{error}</p>
                        </Alert>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
};

export default OTPLoginPage;
