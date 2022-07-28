import {Col, Form, Row} from "react-bootstrap-v5";
import React from "react";

function SearchLoader() {
    return <Row>
        <Col sm={2} />
        <Col>
            <h3>Enter a document ID</h3>
            <Form.Control
                type="input"
                placeholder="Enter ID"
            />
            <h3>Enter a note or pitch sequence</h3>
            <Form.Control
                type="textarea"
                placeholder="Enter Notes"
            />
        </Col>
    </Row>;
}

export default SearchLoader;
