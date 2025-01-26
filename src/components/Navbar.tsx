// Navbar.tsx
import React, {useCallback, useContext, useEffect} from 'react';
import {Navbar as BSNavbar, Nav, Container, Button} from 'react-bootstrap';
import {Icon} from "@iconify/react";
import AppContext from "../AppContext.tsx";
import {SERVER_URL} from "../config.ts";
import {useLocation, useNavigate} from "react-router";

const Navbar: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const accessToken = queryParams.get('access_token');
    const refreshToken = queryParams.get('refresh_token');

    const fetchUserData = useCallback(async () => {
        try {
            const response = await appContext.axiosInstance.get("/user/");
            if (!response.data) {
                throw new Error("No user data available");
            }
            const userData = response.data;
            localStorage.setItem("profile_picture", userData.photo);
            localStorage.setItem("is_staff", userData.is_staff);
            localStorage.setItem("user_id", userData.id);
            appContext.setAuthenticated(true);
        } catch {
            console.error("Failed to fetch user data");
        }
    }, [appContext]);

    const handleLogin = useCallback(async () => {
        if (accessToken && refreshToken) {
            localStorage.setItem("access_token", accessToken);
            localStorage.setItem("refresh_token", refreshToken);

            queryParams.delete('access_token');
            queryParams.delete('refresh_token');

            navigate({
                search: queryParams.toString(),
            });

            await fetchUserData();
        }
    }, [accessToken, refreshToken, fetchUserData]);


    useEffect(() => {
        handleLogin();
    }, [handleLogin]);

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("profile_picture");
        localStorage.removeItem("is_staff");
        localStorage.removeItem("user_id");
        appContext.setAuthenticated(false);
        navigate("/");
    }


    return (
        <BSNavbar expand="lg" className="mb-3">
            <Container fluid>
                <Nav.Link href="/">
                    <BSNavbar.Brand>
                        <img src="/solvro_mono.svg" alt="logo solvro" width={32}/>
                    </BSNavbar.Brand>
                </Nav.Link>
                <BSNavbar.Toggle aria-controls="navbarNav"/>
                <BSNavbar.Collapse id="navbarNav">
                    <Nav className="me-auto mb-2 mb-lg-0">
                        <Nav.Link href="/quizzes">Twoje bazy</Nav.Link>
                        <Nav.Link href="/grades">Oceny</Nav.Link>
                        {localStorage.getItem("is_staff") === "true" && (
                            <Nav.Link href={SERVER_URL + "/admin/"} target={"_blank"}>Panel administratora</Nav.Link>
                        )}
                    </Nav>
                    <Nav>
                        {appContext.isAuthenticated ? (
                            <>
                                <Nav.Link href="/profile">
                                    <Button variant={appContext.theme.getOppositeTheme()}
                                            className="d-inline-flex gap-1 align-items-center">
                                        {localStorage.getItem("profile_picture") ? (
                                            <img src={localStorage.getItem("profile_picture")!} alt="Profilowe"
                                                 id="profile-pic" style={{
                                                borderRadius: '50%',
                                                width: '1.5em',
                                                height: '1.5em',
                                                objectFit: 'cover'
                                            }}/>
                                        ) : (
                                            <Icon icon="bi:person-circle"></Icon>
                                        )}
                                        <span>Profil</span>
                                    </Button>
                                </Nav.Link>
                                <Nav.Link className="ps-0" onClick={handleLogout}>
                                    <Button variant="danger"
                                            className="d-flex align-items-center justify-content-center p-2 fs-5">
                                        <Icon icon="bi:box-arrow-right"></Icon>
                                    </Button>
                                </Nav.Link>
                            </>
                        ) : (
                            <Nav.Link href={`${SERVER_URL}/login/usos?jwt=true&redirect=${document.location}`}>
                                <Button variant={appContext.theme.getOppositeTheme()}
                                        className="d-inline-flex gap-1 align-items-center">
                                    <Icon icon="bi:box-arrow-in-right"></Icon>
                                    Zaloguj się
                                </Button>
                            </Nav.Link>
                        )}
                    </Nav>
                </BSNavbar.Collapse>
            </Container>
        </BSNavbar>
    );
};

export default Navbar;