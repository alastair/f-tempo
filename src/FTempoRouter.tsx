import {
    Navigate,
    Route,
    Routes,
} from "react-router-dom";
import ResourceLoader from "./ResourceLoader";
import FTempo from "./ftempo/FTempo";
import HelpPage from "./HelpPage";
import ExampleLoader from "./ExampleLoader";
import SearchLoader from "./SearchLoader";
import BrowseLoader from "./BrowseLoader";
import ExternalLoader from "./ExternalLoader";

const FTempoRouter = () => {
    return (
        <Routes>
            <Route path="/" element={<Navigate replace to={"/choose"} />} />
            <Route path="/choose" element={<ResourceLoader />} />
            <Route path="/examples" element={<ExampleLoader />} />
            <Route path="/search" element={<SearchLoader />} />
            <Route path="/browse" element={<BrowseLoader />} />
            <Route path="/external" element={<ExternalLoader />} />
            <Route path="/ftempo" element={<Navigate replace to={"/ftempo/GB-Lbl/A103b/GB-Lbl_A103b_025_0"} />} />
            <Route path="/ftempo/:library/:book/:id" element={<FTempo />} />
            <Route path="/help" element={<HelpPage />} />
            <Route
                path="*"
                element={
                    <main style={{ padding: "1rem" }}>
                        <p>There's nothing here!</p>
                    </main>
                }
            />
        </Routes>
    );
};

export default FTempoRouter;
