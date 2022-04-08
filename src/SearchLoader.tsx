import {useState} from "react";
import {Button, Col, Form, Row, Stack} from "react-bootstrap";
import {useNavigate} from "react-router-dom";
import {useApiClient} from "./App";

const SearchLoader = () => {
    const navigate = useNavigate();
    const apiClient = useApiClient();

    const [documentId, setDocumentId] = useState('');
    const [documentIdError, setDocumentIdError] = useState(false);

    const loadDocument = (documentId: string) => {
        setDocumentIdError(false);
        apiClient.metadata(documentId).then(response => {
            navigate(`/ftempo/${response.library}/${response.book_id}/${response.page_id}`);
        }).catch(e => {
            setDocumentIdError(true);
        });
    };

    return <Row className="justify-content-md-center">
        <Col sm={5}>
            <Form.Group>
                <h3>Enter a document ID</h3>
                <Stack direction="horizontal" gap={3}>
                    <Form.Control
                        type="input"
                        value={documentId}
                        onChange={(e) => setDocumentId(e.target.value)}
                        placeholder="Enter ID"
                        onSubmit={() => {loadDocument(documentId);}}
                    />
                    <Button onClick={() => {loadDocument(documentId);}}>Load</Button>
                </Stack>
                {documentIdError && <Form.Text id="passwordHelpBlock" className="text-danger">
                    This ID isn't valid, try again
                </Form.Text>}
            </Form.Group>
            <Form.Group>
                <h3>Enter a note or pitch sequence</h3>
                <Form.Control
                    type="textarea"
                    placeholder="Enter Notes"
                />
            </Form.Group>
        </Col>
    </Row>;
};

export default SearchLoader;
