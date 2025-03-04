import {Alert, Button, Card} from 'react-bootstrap';
import {useNavigate, useParams} from "react-router";
import PropagateLoader from "react-spinners/PropagateLoader";
import {useCallback, useContext, useEffect, useState} from "react";
import AppContext from "../AppContext.tsx";
import axios, {AxiosError} from "axios";
import {SERVER_URL} from "../config.ts";

const LoginLinkPage = () => {
    const {token} = useParams<{ token: string }>();
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    document.title = "Logowanie OTP - Testownik Solvro";

    const handleLogin = useCallback(async () => {
        try {
            const response = await axios.post(`${SERVER_URL}/login-link/`, {token});
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
        }
    }, [token]);

    useEffect(() => {
        handleLogin();
    }, [handleLogin]);

    return (
        <Card className="shadow border-0">
            <Card.Body>
                {error ? (
                    <Alert variant="danger">
                        <p>Wystąpił błąd podczas logowania za pomocą linku.</p>
                        <p>{error}</p>
                        <Button
                            variant="link"
                            className="alert-link p-0"
                            onClick={() => window.location.reload()}
                        >
                            Wyślij ponownie link
                        </Button>
                    </Alert>
                ) : (
                    <div className="text-center mb-5">
                        <p>Trwa logowanie...</p>
                        <PropagateLoader color={appContext.theme.getOppositeThemeColor()} loading={true} size={15}/>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default LoginLinkPage;
