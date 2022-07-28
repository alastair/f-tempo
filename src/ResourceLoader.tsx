import React, { useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";


const sampleScores = [
    {
        name: "Different editions of Berchem, 'O s'io potessi donna' (<i>Cantus</i>)",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Mahler_Symphony_No4_Doblinger-4hands/master/Mahler_No4_1-Doblinger-4hands.mei",
    },
    {
        name: "Very different editions of Striggio, 'Alma reale' (<i>Canto</i>)",
        url: "https://trompa-mtg.upf.edu/data/meiconversion/79f3e3c5-29b7-424f-9144-4cc6d720c206.mei",
    },
];

export default function ResourceLoader() {
    const [userUrl, setUserUrl] = useState("");
    const history = useNavigate();

    const loadUrl = (url: string) => {
        history({
            pathname: "/annotate",
            search: `?resource=${url}`,
        });
    };

    return (
        <Row>
            <Col sm={2} />
            <Col>
                <p>&nbsp;</p>
                <h2>Search within the corpus</h2>
                <h3>Enter a document ID</h3>
                <Form.Control
                    type="input"
                    placeholder="Enter ID"
                    value={userUrl}
                    onChange={(e) => setUserUrl(e.target.value)}
                />
                <h3>Enter a note or pitch sequence</h3>
                <Form.Control
                    type="textarea"
                    placeholder="Enter Notes"
                    value={userUrl}
                    onChange={(e) => setUserUrl(e.target.value)}
                />
                <h3>Choose an example</h3>
                <ul>
                    {sampleScores.map((score) => {
                        return (
                            <li key={score.url}>
                                <a
                                    href={`/annotate?resource=${score.url}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        loadUrl(score.url);
                                    }}
                                >
                                    {score.name}
                                </a>
                            </li>
                        );
                    })}
                </ul>
                <h3>Browse the F-Tempo corpus</h3>
                <ul>
                    <li><a href="x">Berlin Staatsbibliothek (D-Bsb)</a></li>
                    <li><a href="x">British Library (GB-Lbl)</a></li>
                    <li><a href="x">Bibliothèque nationale (F-Pn)</a></li>
                </ul>
                <p>or</p>
                <h2>Load an external MEI file</h2>
                <h3>Enter a URL</h3>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (userUrl && userUrl !== "") {
                            loadUrl(userUrl);
                        }
                    }}
                >
                    <Row>
                        <Col sm={11}>
                            <Form.Control
                                type="input"
                                placeholder="Enter URL"
                                value={userUrl}
                                onChange={(e) => setUserUrl(e.target.value)}
                            />
                        </Col>
                        <Col>
                            <Button
                                variant="primary"
                                type="submit"
                                onClick={() => {
                                    if (userUrl && userUrl !== "") {
                                        loadUrl(userUrl);
                                    }
                                }}
                            >Load</Button>
                        </Col>
                    </Row>
                </Form>
                <h3>Search the TROMPA early music database</h3>
                <p>or</p>
                <h3>Upload an image</h3>
            </Col>
            <Col sm={2} />
        </Row>
    );
}
