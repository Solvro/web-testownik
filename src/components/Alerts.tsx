import React from "react";
import {Alert, Container} from "react-bootstrap";
import axios from "axios";
import {SERVER_URL} from "../config.ts";
import DOMPurify from "dompurify";


interface AlertData {
    id: string;
    title: string;
    content: string;
    active: boolean;
    dismissible: boolean;
    color: string;
    created_at: string;
    updated_at: string;
}

const Alerts: React.FC = () => {
    const [alerts, setAlerts] = React.useState<AlertData[]>([]);
    const [dismissedAlerts, setDismissedAlerts] = React.useState<string[]>(localStorage.getItem("dismissedAlerts") ? JSON.parse(localStorage.getItem("dismissedAlerts")!) : []);

    const dismissAlert = (alertId: string) => {
        setDismissedAlerts([...dismissedAlerts, alertId]);
        localStorage.setItem("dismissedAlerts", JSON.stringify([...dismissedAlerts, alertId]));
    }

    React.useEffect(() => {
        axios.get(`${SERVER_URL}/alerts/`)
            .then((response) => setAlerts(response.data))
            .catch((error) => console.error("Failed to fetch alerts:", error));
    }, []);

    if (!alerts.length || !alerts.some((alert) => !dismissedAlerts.includes(alert.id) && alert.active || !alert.dismissible)) {
        return null;
    }

    return (
        <Container className="mt-3 px-0">
            {alerts.map((alert) => (
                (!dismissedAlerts.includes(alert.id) || !alert.dismissible) && alert.active && (
                    <Alert key={alert.id} variant={alert.color} dismissible={alert.dismissible}
                           onClose={() => dismissAlert(alert.id)}>
                        {alert.title && <Alert.Heading>{alert.title}</Alert.Heading>}
                        <p dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(alert.content)}}></p>
                    </Alert>
                )
            ))}
        </Container>
    );
};

export default Alerts;