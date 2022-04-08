import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';
import Navigation from './Navigation';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import FTempoRouter from './FTempoRouter';
import React from "react";
import ApiClient from "./ApiClient";

interface ApiClientObject {
    client: ApiClient;
}

const ApiClientContext = React.createContext<ApiClientObject>(null!);

export function useApiClient(): ApiClient {
    return React.useContext(ApiClientContext).client;
}

function ApiWrapper({children} : {children?: React.ReactNode}) {
    const client = new ApiClient();
    const value = {client};
    return (
        <ApiClientContext.Provider value={value}>
            {children}
        </ApiClientContext.Provider>
    );
}


function App() {
    return (
        <Router>
            <ApiWrapper>
                <Navigation/>
                <Container fluid={true}>
                    <FTempoRouter />
                </Container>
            </ApiWrapper>
        </Router>
    );
}

export default App;
