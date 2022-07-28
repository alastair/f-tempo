import {Container, Nav, Navbar} from "react-bootstrap-v5";
import {Link} from "react-router-dom";

export default function Navigation() {
    return (
        <Navbar bg="dark" expand="lg" variant="dark">
            <Container>
                <Navbar.Brand href="#home">F-Tempo</Navbar.Brand>
                <Navbar.Collapse id="responsive-navbar-nav">
                    <Nav>
                        <Nav.Link as={Link} to="/examples">Examples</Nav.Link>
                    </Nav>
                    <Nav>
                        <Nav.Link as={Link} to="/search">Manual search</Nav.Link>
                    </Nav>
                    <Nav>
                        <Nav.Link as={Link} to="/browse">Browse corpus</Nav.Link>
                    </Nav>
                    <Nav>
                        <Nav.Link as={Link} to="/external">Upload</Nav.Link>
                    </Nav>
                    <Nav>
                        <Nav.Link>Help</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}
