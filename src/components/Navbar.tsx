// Navbar.tsx
import React, {useContext} from 'react';
import {Navbar as BSNavbar, Nav, Container, Button} from 'react-bootstrap';
import {Icon} from "@iconify/react";
import AppContext from "../AppContext.tsx";
import {SERVER_URL} from "../config.ts";
import {useNavigate} from "react-router";

const Navbar: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();

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
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                             className="feather feather-home">
                            <path d="M3 18v-6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v6"></path>
                            <path d="M13 13v5a2 2 0 0 0 2 2h3"></path>
                            <path d="M18 13v-6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6"></path>
                            <line x1="13" y1="6" x2="13" y2="11"></line>
                            <line x1="18" y1="6" x2="18" y2="11"></line>
                        </svg>
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