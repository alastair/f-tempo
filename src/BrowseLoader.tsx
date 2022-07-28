import {Col, Form, Row} from "react-bootstrap-v5";
import React from "react";

function BrowseLoader() {
    return <Row>
        <Col sm={2} />
        <Col>
            <h3>Browse the F-Tempo corpus</h3>
            <ul>
                <li><a href="x">Berlin Staatsbibliothek (D-Bsb)</a></li>
                <li><a href="x">British Library (GB-Lbl)</a></li>
                <li><a href="x">Bibliothèque nationale (F-Pn)</a></li>
            </ul>
            <h3>Search the TROMPA early music database</h3>
            <Form.Control
                type="input"
                placeholder="Enter search term"
            />
        </Col>
    </Row>;
}

export default BrowseLoader;