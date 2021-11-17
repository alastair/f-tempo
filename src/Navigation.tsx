import {Container, Nav, Navbar} from "react-bootstrap-v5";

export default function Navigation() {
    return (
        <Navbar bg="dark" expand="lg" variant="dark">
            <Container>
                <Navbar.Brand href="#home">F-Tempo</Navbar.Brand>
                <Navbar.Collapse id="responsive-navbar-nav">
                    <Nav>
                        <Nav.Link>Thing</Nav.Link>
                    </Nav>
                    <Nav>
                        <Nav.Link>other Thing</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
                <Navbar.Collapse id="responsive-navbar-nav2">
                    <Nav className="ms-auto">
                        <Nav.Link>Thing</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}
