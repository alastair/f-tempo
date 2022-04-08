import {Col, Row} from "react-bootstrap";
import LeftPane from "./LeftPane";
import SearchOptions from "./SearchOptions";
import {useCallback, useEffect, useState} from "react";
import SearchResultList from "./SearchResultList";
import SearchResultView from "./SearchResultView";
import {useNavigate, useParams} from "react-router-dom";
import FakeSearchResultList from "./FakeSearchResultList";
import { CSSTransition } from 'react-transition-group';
import {useApiClient} from "../App";
import {CurrentPageData} from "../ApiClient";


type FTempoSearchResults = {
    status: 'ok' | 'error';
    data: any;
    error?: string;
}

const FTempo = () => {

    const [searchResults, setSearchResults] = useState<null | any>(null);
    const [searchError, setSearchError] = useState("");
    const [searchResultSelectedIndex, setSearchResultSelectedIndex] = useState(0);
    const [currentPage, setCurrentPage] = useState<CurrentPageData|undefined>(undefined);
    const [numSearchResults, setNumSearchResults] = useState(0);
    const [resultsLoading, setResultsLoading] = useState(false);

    const params = useParams();
    const navigate = useNavigate();
    const apiClient = useApiClient();

    useEffect(() => {
        // On page load, check if the URL structure is correct, get data for the page
        apiClient.metadata(params.id!).then(response => {
            if (params.library !== response.library || params.book !== response.book_id) {
                navigate(`/ftempo/${response.library}/${response.book_id}/${response.page_id}`);
            } else {
                setCurrentPage(response);
            }
        }).catch(e => {
            alert('error');
        });
    }, [apiClient, navigate, params.book, params.id, params.library]);

    const onDoSearch = useCallback((searchOptions: any) => {
        setSearchResults(null);
        setSearchError("");
        setNumSearchResults(parseInt(searchOptions.num_results, 10) || 10);
        if (!currentPage?.page_id) {
            return;
        }
        setResultsLoading(true);
        const query = {...searchOptions, id: currentPage.page_id};
        apiClient.query(query).then(data => {
            const result = (data as FTempoSearchResults);
            if (result.status === "ok") {
                setSearchResults(result.data);
            } else {
                setSearchError(result.error!);
            }
            setResultsLoading(false);
        }).catch((error) => {
            setSearchError(error.toString());
            setResultsLoading(false);
        });
    }, [apiClient, currentPage?.page_id]);

    return <Row>
        <Col>
            {currentPage && <LeftPane page={currentPage} />}
        </Col>
        <Col md={3}>
            {searchError && <div>{searchError}</div>}
            <SearchOptions onSearch={onDoSearch} readyToSearch={Boolean(currentPage?.page_id)} hasActiveSearch={Boolean(searchResults)} />
            <CSSTransition in={searchResults !== null || resultsLoading} timeout={300} classNames="results">
                <div style={{overflow:"hidden"}}>
                    {searchResults && <SearchResultList results={searchResults} onSelectResult={setSearchResultSelectedIndex} currentPage={currentPage} />}
                    {!searchResults && resultsLoading && <FakeSearchResultList numResults={numSearchResults} />}
                </div>
            </CSSTransition>
        </Col>
        <Col>
            {searchResults && <SearchResultView result={searchResults.results[searchResultSelectedIndex]} />}
        </Col>
    </Row>;
};

export default FTempo;
