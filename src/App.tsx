import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';
import Navigation from './Navigation';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import FTempoRouter from './FTempoRouter';


function App() {
    return (
        <Router>
            <Navigation/>
            <Container fluid={true}>
                <FTempoRouter />
            </Container>
        </Router>
    );
}

export default App;
