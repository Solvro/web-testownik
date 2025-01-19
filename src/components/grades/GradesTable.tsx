import React, {useEffect, useState} from "react";
import {Badge, Card, Placeholder} from "react-bootstrap";
import {PuffLoader} from "react-spinners";
import "../../styles/ProfileDetails.css";
import {Simulate} from "react-dom/test-utils";
import animationStart = Simulate.animationStart;

interface ProfileDetailsProps {
    userData?: {
        id: number;
        full_name: string;
        student_number: string;
        email: string;
        photo_url: string;
        is_superuser: boolean;
        is_staff: boolean;
    } | null;
    loading?: boolean;
}
const ProgressBar = ({ index, progress }) => {
    return (
        <div className="progress-bar"
             data-progress-bar-index={index}
             style={{ width: `${progress}%` }}
             aria-valuenow={progress}
             aria-valuemin="0"
             aria-valuemax="100">
        </div>
    );
};
const ProfileDetails: React.FC<ProfileDetailsProps> = ({userData, loading}) => {

    return (
        <Card>
            <table className="table table-hover">
                <thead>
                <tr>
                    <th scope="col">Przedmiot</th>
                    <th scope="col">ECTS</th>
                    <th scope="col">Ocena</th>
                </tr>
                </thead>
                <tfoot>
                <tr>
                    <th>Średnia</th>
                    <th></th>
                    <th id="average">
                        <ProgressBar progress={1} index={2}/>
                    </th>
                </tr>
                </tfoot>
                <tbody id="grades">
                <tr>
                    <td>
                        <div className="progress">
                            <div className="progress-bar progress-bar-striped progress-bar-animated bg-secondary"
                                 role="progressbar"
                                 aria-valuenow={0}
                                 aria-valuemin={0}
                                 aria-valuemax={100}
                                 data-progress-bar-index={0}
                                 style={{width: 0}}>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div className="progress">
                            <div className="progress-bar progress-bar-striped progress-bar-animated bg-secondary"
                                 role="progressbar"
                                 aria-valuenow={0}
                                 aria-valuemin={0}
                                 aria-valuemax={100}
                                 data-progress-bar-index={1}
                                 style={{width: 0}}>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div className="progress">
                            <div className="progress-bar progress-bar-striped progress-bar-animated bg-secondary"
                                 role="progressbar"
                                 aria-valuenow={0}
                                 aria-valuemin={0}
                                 aria-valuemax={100}
                                 data-progress-bar-index={2}
                                 style={{width: 0}}>
                            </div>
                        </div>
                    </td>
                </tr>
                </tbody>
            </table>

            {/*<Card className="border-0 shadow">
        {loading && (
            <Placeholder className="d-flex flex-column align-items-center text-nowrap" as={Card.Body}
                         animation="wave">
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
                <img
                    src={userData?.photo_url}
                    alt="Profilowe"
                    style={{
                        borderRadius: "50%",
                        width: "6em",
                        height: "6em",
                        objectFit: "cover",
                    }}
                />

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
    </Card>*/}
        </Card>
    )
        ;
};

export default ProfileDetails;