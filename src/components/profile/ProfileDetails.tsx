import React, {useContext, useEffect, useState} from "react";
import {Badge, Card, Placeholder, Modal, Button} from "react-bootstrap";
import {PuffLoader} from "react-spinners";
import "../../styles/ProfileDetails.css";
import AppContext from "../../AppContext.tsx";
import {Icon} from "@iconify/react";
import {toast} from "react-toastify";

interface UserData {
    id: number;
    full_name: string;
    student_number: string;
    email: string;
    photo_url: string;
    overriden_photo_url: string;
    photo: string;
    is_superuser: boolean;
    is_staff: boolean;
}

interface ProfileDetailsProps {
    userData: UserData | null;
    loading: boolean;
    setUserData: (data: UserData) => void;
}

const ProfileDetails: React.FC<ProfileDetailsProps> = ({userData, loading, setUserData}) => {
    const appContext = useContext(AppContext);
    const [showModal, setShowModal] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(userData?.photo || "");

    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => {
        setSelectedPhoto(userData?.photo || "");
        setShowModal(false);
    }

    const handleSavePhoto = () => {
        handleCloseModal();
        appContext.axiosInstance.patch("/user/", {overriden_photo_url: selectedPhoto !== userData?.photo_url ? selectedPhoto : null})
            .then(() => {
                localStorage.setItem("profile_picture", selectedPhoto);
                document.getElementById("profile-pic")?.setAttribute("src", selectedPhoto);
                if (userData) setUserData({...userData, photo: selectedPhoto});
            })
            .catch((err) => console.error("Error saving photo:", err));


    };

    useEffect(() => {
        setSelectedPhoto(userData?.photo || "");
    }, [userData?.photo]);

    const avatarOptions = [
        userData?.photo_url,
        encodeURI(`https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name}`),
        encodeURI(`https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name} 2`),
        encodeURI(`https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name} 3`),
        encodeURI(`https://api.dicebear.com/9.x/dylan/svg?seed=${userData?.full_name}`),
        encodeURI(`https://api.dicebear.com/9.x/micah/svg?seed=${userData?.full_name}`),
        encodeURI(`https://api.dicebear.com/9.x/micah/svg?seed=${userData?.full_name} 2`),
        encodeURI(`https://api.dicebear.com/9.x/shapes/svg?seed=${userData?.full_name}`),
        encodeURI(`https://api.dicebear.com/9.x/initials/svg?seed=${userData?.full_name}`),
    ];

    return (
        <Card className="border-0 shadow">
            {loading && (
                <Placeholder
                    className="d-flex flex-column align-items-center text-nowrap"
                    as={Card.Body}
                    animation="wave"
                >
                    <div className="d-flex justify-content-center m-3">
                        <PuffLoader color="#4c6ef5" size="6em"/>
                    </div>
                    <Placeholder as="h1" xs={6} className="rounded-3"/>
                    <Placeholder as="h2" xs={4} className="rounded-3"/>
                    <Placeholder as="span" xs={2} className="rounded-3"/>
                    <hr className="w-100"/>
                    <h6 className="text-muted">Prywatne dane:</h6>
                    <Placeholder xs={3} className="rounded-3 mb-2"/>
                    <Placeholder xs={4} className="rounded-3"/>
                </Placeholder>
            ) || (
                <Card.Body className="d-flex flex-column align-items-center text-nowrap">
                    <div style={{position: "relative"}}>
                        <img
                            src={userData?.photo}
                            alt="Profilowe"
                            style={{
                                borderRadius: "50%",
                                width: "6em",
                                height: "6em",
                                objectFit: "cover",
                            }}
                        />
                        <Badge
                            pill
                            bg={appContext.theme.getTheme()}
                            className="d-flex justify-content-center align-items-center p-0 shadow"
                            style={{
                                position: "absolute",
                                top: "0",
                                right: "-0.5em",
                                cursor: "pointer",
                                width: "2em",
                                height: "2em",
                                color: appContext.theme.getOppositeThemeColor(),
                            }}
                            onClick={handleOpenModal}
                        >
                            <Icon icon="akar-icons:pencil"/>
                        </Badge>
                    </div>
                    <h1 className="mt-3">{userData?.full_name}</h1>
                    <h2 className="text-muted">{userData?.student_number}</h2>
                    {(userData?.is_superuser || userData?.is_staff) && (
                        <div className="d-flex gap-2">
                            {userData?.is_superuser && (
                                <Badge bg="danger" className="bg-opacity-25 text-danger">Administrator</Badge>
                            )}
                            {userData?.is_staff && (
                                <Badge bg="warning" className="bg-opacity-25 text-warning">Obsługa</Badge>
                            )}
                            <Badge bg="success" className="bg-opacity-25 text-success">Student</Badge>
                        </div>
                    ) || (
                        <Badge bg="success" className="bg-opacity-25 text-success">Student</Badge>
                    )}
                    <hr className="w-100"/>
                    <h5 className="text-muted">Prywatne dane:</h5>
                    <ul className="list-unstyled text-center">
                        <li>Id: {userData?.id}</li>
                        <li>Email: {userData?.email}</li>
                    </ul>
                </Card.Body>
            )}
            <Modal show={showModal} onHide={handleCloseModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Wybierz zdjęcie profilowe</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="d-flex flex-wrap gap-3 justify-content-center">
                        {avatarOptions.map((url, index) => (
                            <img
                                key={index}
                                src={url}
                                alt={`Avatar ${index}`}
                                style={{
                                    borderRadius: "50%",
                                    width: "5em",
                                    height: "5em",
                                    objectFit: "cover",
                                    cursor: "pointer",
                                    border: selectedPhoto === url ? "3px solid #4c6ef5" : "3px solid transparent",
                                    boxShadow: selectedPhoto === url ? "0 0 10px rgba(76, 110, 245, 0.5)" : "none",
                                }}
                                onClick={() => setSelectedPhoto(url || "")}
                            />
                        ))}
                        {!avatarOptions.includes(selectedPhoto) && (
                            <img
                                src={selectedPhoto}
                                alt="Avatar"
                                style={{
                                    borderRadius: "50%",
                                    width: "5em",
                                    height: "5em",
                                    objectFit: "cover",
                                    cursor: "pointer",
                                    border: "3px solid #4c6ef5",
                                    boxShadow: "0 0 10px rgba(76, 110, 245, 0.5)",
                                }}
                                onClick={() => toast("To zdjęcie nie jest już dostępne. Po zmianie na inne nie będzie możliwości powrotu.")}
                            />
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Anuluj
                    </Button>
                    <Button variant="primary" onClick={handleSavePhoto}>
                        Zapisz
                    </Button>
                </Modal.Footer>
            </Modal>
        </Card>
    );
};

export default ProfileDetails;