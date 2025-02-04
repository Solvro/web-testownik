import React, { useContext } from 'react';
import { Modal, Button } from 'react-bootstrap';
import AppContext from '../AppContext.tsx';

interface ReportBugModalProps {
    show: boolean;
    onHide: () => void;
}

const ReportBugModal: React.FC<ReportBugModalProps> = ({ show, onHide }) => {
    const appContext = useContext(AppContext);
    return (
        <Modal
            id="reportBugModal"
            tabIndex={-1}
            aria-labelledby="reportBugModalLabel"
            aria-hidden="true"
            show={show}
            onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title id="reportBugModalLabel">
                    Zgłoś błąd w Testowniku
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>yey</p>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    variant={`outline-${appContext.theme.getOppositeTheme()}`}
                    onClick={onHide}>
                    Zamknij
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ReportBugModal;
