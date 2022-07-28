import {useCallback, useEffect, useState} from "react";
import {Button, ButtonToolbar, Col, Form, Row} from "react-bootstrap";
import {useSearchParams} from "react-router-dom";

type SelectOptions = {
    value: string
    label: string
}

const rankingTypes: SelectOptions[] = [
    {value: 'jaccard', label: 'Jaccard Distance'},
    {value: 'boolean', label: 'Basic'},
    {value: 'solr', label: 'Solr'},
];

const numResultsTypes: SelectOptions[] = [
    {value: '5', label: '5'},
    {value: '10', label: '10'},
    {value: '15', label: '15'},
    {value: '20', label: '20'},
    {value: '25', label: '25'},
    {value: '30', label: '30'}
];

type SearchOptionsProps = {
    onSearch: (searchOptions: any) => void
    readyToSearch: boolean
    hasActiveSearch: boolean
};

/**
 * Show search options.
 * This component interacts with react-router in order to handle
 *  - On page load, if any query parameters are invalid, all query parameters are cleared
 *  - When a form option is changed, state is modified
 *  - When state is modified, query parameters are set (
 * @param props
 * @constructor
 */

/*
TODO: any time we use setSearchParams, use 'replace' to make sure that we don't add another history item
 */
const SearchOptions = (props: SearchOptionsProps) => {
    const {readyToSearch, onSearch, hasActiveSearch} = props;
    const [ranking, setRanking] = useState('jaccard');
    const [numResults, setNumResults] = useState('10');
    const [collectionList, setCollectionList] = useState<string[]>([]);
    const [collections, setCollections] = useState<boolean[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();

    const paramCollections = searchParams.get('collections_to_search');
    const paramNumResults = searchParams.get('num_results');
    const paramSimilarityType = searchParams.get('similarity_type');

    const handleCollectionTick = (position: number) => {
        const updatedCheckedState = collections.map((item, index) =>
            index === position ? !item : item
        );
        setCollections(updatedCheckedState);
    };

    // On component load get the list of catalogues
    useEffect(() => {
        fetch(`/api/catalogues`).then(r => {
            if (r.status === 200) {
                return r.json();
            } else {
                alert('error');
            }
        }).then(response => {
            setCollections(new Array(response.data.length).fill(true));
            setCollectionList(response.data);
        });
    }, []);

    // when the search button is pressed, set the query parameters to the current state
    const doSearch = useCallback(() => {
        const searchOptions = {
            similarity_type: ranking,
            num_results: numResults,
            collections_to_search: collectionList.filter(
                (element, index) => collections[index]
            ).join(" ")
        };
        setSearchParams(searchOptions, {replace: true});
    }, [collectionList, collections, numResults, ranking, setSearchParams]);

    // TODO: Ideally this should re-trigger the search if a search has already been made
    //  and a query parameter changes. In reality it re-triggers the search also when
    //  hasActiveSearch changes from false to true, causing setSearchParams() to be called again,
    //  resulting in any set hash value being cleared.
    // useEffect(() => {
    //     if (hasActiveSearch) {
    //         doSearch();
    //     }
    // }, [collections, numResults, ranking, hasActiveSearch, doSearch]);

    useEffect(() => {
        // Check that the search parameters are valid and if they are,
        // perform a search
        const validNumResults = numResultsTypes.map((r) => r.value);
        const validRanking = rankingTypes.map((r) => r.value);

        // Don't do anything if the Collection List hasn't been loaded yet
        if (!collectionList.length) {
            return;
        }

        // If any parameter is invalid, clear them all
        if (paramNumResults && !validNumResults.includes(paramNumResults)) {
            setSearchParams({}, {replace: true});
            return;
        } else if (paramNumResults) {
            setNumResults(paramNumResults);
        }

        if (paramSimilarityType && !validRanking.includes(paramSimilarityType)) {
            setSearchParams({}, {replace: true});
            return;
        } else if (paramSimilarityType) {
            setRanking(paramSimilarityType);
        }

        let goodCollections = true;
        let collectionsToSet: boolean[] = [];
        const paramCollectionParts = paramCollections?.split(" ");
        if (paramCollectionParts) {
            paramCollectionParts.forEach((col) => {
                if (col && !collectionList.includes(col)) {
                    goodCollections = false;
                    setSearchParams({}, {replace: true});
                    return;
                }
            });
            if (goodCollections) {
                collectionsToSet = collectionList.map((col) => {
                    return paramCollectionParts.includes(col);
                });
                setCollections(collectionsToSet);
            }
        }
        if (readyToSearch && paramSimilarityType && paramNumResults && collectionsToSet) {
            onSearch({
                similarity_type: paramSimilarityType,
                num_results: paramNumResults,
                collections_to_search: collectionList.filter(
                    (element, index) => collectionsToSet[index]
                )
            });
        }
    }, [paramCollections, paramNumResults, paramSimilarityType, setSearchParams, readyToSearch, onSearch, collectionList]);

    return <div>
        <Form.Group as={Row} className="mb-3" controlId="form-result-ranking">
            <Form.Label column sm={4}>Result Ranking</Form.Label>
            <Col>
                <Form.Select value={ranking} onChange={
                    (e) => setRanking(e.currentTarget.value) }>
                    {rankingTypes.map(rt => {
                        return <option key={rt.value} value={rt.value}>{rt.label}</option>;
                    })}
                </Form.Select>
            </Col>
        </Form.Group>
        <Form.Group as={Row} className="mb-3" controlId="form-num-results">
            <Form.Label column sm={4}>Results to display</Form.Label>
            <Col>
                <Form.Select value={numResults} onChange={
                    (e) => setNumResults(e.currentTarget.value)
                }>
                    {numResultsTypes.map(rt => {
                        return <option key={rt.value} value={rt.value}>{rt.label}</option>;
                    })}
                </Form.Select>
            </Col>
        </Form.Group>
        <Form.Group as={Row} className="mb-3" controlId="form-collections">
            <label>Collections to search</label>
            <Col>
                {collectionList.map((collection, i) => {
                    return <Form.Check
                        key={collection}
                        inline
                        label={collection}
                        type={"checkbox"}
                        checked={collections[i]}
                        id={`form-collection-check-${i}`}
                        onChange={() => handleCollectionTick(i)} />;
                })}
            </Col>
        </Form.Group>

        <ButtonToolbar>
            <Button variant="primary" type="submit" onClick={doSearch}>Search</Button>
        </ButtonToolbar>
    </div>;
};

export default SearchOptions;
