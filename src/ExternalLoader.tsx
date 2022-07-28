import {Button, Col, Form, Row} from "react-bootstrap-v5";
import React from "react";

function ExternalLoader() {
    return <Row>
        <Col sm={2} />
        <Col>
            <h3>Upload an image</h3>
            <Button>Select image</Button>
            <h3>Load an External MEI file</h3>
            <Form.Control
                type="input"
                placeholder="Enter URL"
            />
        </Col>
    </Row>;
}

export default ExternalLoader;