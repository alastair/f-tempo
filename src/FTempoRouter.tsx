import {
    Redirect,
    Route,
    Switch,
} from "react-router-dom";
import ResourceLoader from "./ResourceLoader";
import React from "react";
import FTempo from "./FTempo";
import HelpPage from "./HelpPage";

const FTempoRouter = () => {
    return (
        <Switch>
            <Route exact path="/">
                <Redirect to="/choose" />
            </Route>
            <Route exact path="/choose">
                <ResourceLoader />
            </Route>
            <Route exact path="/ftempo">
                <FTempo />
            </Route>
            <Route exact path="/help">
                <HelpPage />
            </Route>
        </Switch>
    );
};

export default FTempoRouter;
