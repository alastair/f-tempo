import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import React from 'react';
import './App.css';
import Navigation from './Navigation';
import { Container } from 'react-bootstrap-v5';
import FTempo from "./FTempo";
import 'bootstrap/dist/css/bootstrap.min.css';


function App() {
    return (
        <Router>
            <Navigation/>
            <Container fluid="lg">
                <Switch>
                    <Route exact path="/">
                        <FTempo />
                    </Route>
                </Switch>
            </Container>
        </Router>
    );
}

export default App;
