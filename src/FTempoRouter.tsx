import {
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import ResourceLoader from "./ResourceLoader";
import React from "react";
import FTempo from "./FTempo";
import HelpPage from "./HelpPage";
import ExampleLoader from "./ExampleLoader";
import SearchLoader from "./SearchLoader";
import BrowseLoader from "./BrowseLoader";
import ExternalLoader from "./ExternalLoader";

const FTempoRouter = () => {
    /*
     <Route exact path="/"  />
     */
    return (
        <Routes>
            <Route path="/" element={<Navigate replace to={"/choose"} />} />
            <Route path="/choose" element={<ResourceLoader />} />
            <Route path="/examples" element={<ExampleLoader />} />
            <Route path="/search" element={<SearchLoader />} />
            <Route path="/browse" element={<BrowseLoader />} />
            <Route path="/external" element={<ExternalLoader />} />
            <Route path="/ftempo" element={<FTempo />} />
            <Route path="/help" element={<HelpPage />} />
        </Routes>
    );
};

export default FTempoRouter;
