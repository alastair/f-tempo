import {Col, Row} from "react-bootstrap-v5";
import LeftPane from "./LeftPane";
import SearchOptions from "./SearchOptions";
import {useState} from "react";
import SearchResultList from "./SearchResultList";
import SearchResultView from "./SearchResultView";

type FTempoSearchResults = {
    status: 'ok' | 'error';
    data: any;
    error?: string;
}

const FTempo = () => {

    const id = "GB-Lbl_A103b_025_0";
    const [searchResults, setSearchResults] = useState<null | any>();
    const [searchError, setSearchError] = useState("");
    const [searchResultSelectedIndex, setSearchResultSelectedIndex] = useState(0);

    const onDoSearch = (searchOptions: any) => {
        console.debug("search!");
        setSearchResults(null);
        const query = {...searchOptions, id};
        console.debug(query);
        fetch("http://alastairpc:8000/api/query", {
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
        }).catch((error) => {
            setSearchError(error.toString());
        });
    };

    return <Row>
        <Col>
            <LeftPane/>
        </Col>
        <Col md={3}>
            {searchError && <div>{searchError}</div>}
            {searchResults && <SearchResultList results={searchResults} selectedResult={searchResultSelectedIndex} onSelectResult={setSearchResultSelectedIndex}/>}
            <SearchOptions onSearch={onDoSearch}/>
        </Col>
        <Col>
            {searchResults && <SearchResultView result={searchResults[searchResultSelectedIndex]} />}
        </Col>
    </Row>;
};

export default FTempo;
