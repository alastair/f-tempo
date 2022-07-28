import {Navbar} from "react-bootstrap-v5";

export default function Navigation() {
    return (
        <Navbar bg="light" expand="lg">
            <Navbar.Brand href="#home">F-Tempo</Navbar.Brand>
            {/*<Nav className="me-auto">*/}
            {/*    <Nav.Link as={Link} to="/editors/toolkit">Toolkit editor</Nav.Link>*/}
            {/*    <Nav.Link as={Link} to="/editors/motivation">Motivation editor</Nav.Link>*/}
            {/*</Nav>*/}
        </Navbar>
    );
}
