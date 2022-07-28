import {Col, Row} from "react-bootstrap";
import LeftPane from "./LeftPane";
import SearchOptions from "./SearchOptions";
import {useCallback, useEffect, useState} from "react";
import SearchResultList from "./SearchResultList";
import SearchResultView from "./SearchResultView";
import {useNavigate, useParams} from "react-router-dom";
import FakeSearchResultList from "./FakeSearchResultList";
import { CSSTransition, TransitionGroup } from 'react-transition-group';


type FTempoSearchResults = {
    status: 'ok' | 'error';
    data: any;
    error?: string;
}

export type CurrentPageData = {
    library: string;
    book: string;
    id: string;
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

    useEffect(() => {
        // On page load, check if the URL structure is correct, get data for the page
        fetch(`/api/metadata?id=${params.id}`).then(r => {
            if (r.status === 200) {
                return r.json();
            } else {
                alert('error');
            }
        }).then(response => {
            if (params.library !== response.library || params.book !== response.book) {
                navigate(`/ftempo/${response.library}/${response.book}/${response.siglum}`);
            } else {
                setCurrentPage({library: response.library, book: response.book, id: response.siglum});
            }
        });
    }, [navigate, params.book, params.id, params.library]);

    const onDoSearch = useCallback((searchOptions: any) => {
        setSearchResults(null);
        setSearchError("");
        setNumSearchResults(parseInt(searchOptions.num_results, 10) || 10);
        if (!currentPage?.id) {
            return;
        }
        setResultsLoading(true);
        const query = {...searchOptions, id: currentPage.id};
        fetch("/api/query", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(query)
        }).then(r => {
            return r.json();
        }).then(data => {
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
    }, [currentPage?.id]);

    return <Row>
        <Col>
            {currentPage && <LeftPane page={currentPage} />}
        </Col>
        <Col md={3}>
            {searchError && <div>{searchError}</div>}
            <SearchOptions onSearch={onDoSearch} readyToSearch={Boolean(currentPage?.id)} hasActiveSearch={Boolean(searchResults)} />
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
