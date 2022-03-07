import {useCallback, useEffect, useState} from "react";
import {Button, ButtonToolbar, Col, Form, Row} from "react-bootstrap";
import {useNavigate, useSearchParams} from "react-router-dom";

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

const collectionList = [
    'D-Mbs', 'D-Bsb', 'F-Pn', 'GB-Lbl', 'PL-Wn'
];

type SearchOptionsProps = {
    onSearch: (searchOptions: any) => void
    readyToSearch: boolean
};

const SearchOptions = (props: SearchOptionsProps) => {
    const [ranking, setRanking] = useState('jaccard');
    const [numResults, setNumResults] = useState('10');
    const [collections, setCollections] = useState(new Array(collectionList.length).fill(true));

    const [searchParams, setSearchParams] = useSearchParams();

    const handleCollectionTick = (position: number) => {
        const updatedCheckedState = collections.map((item, index) =>
            index === position ? !item : item
        );
        setCollections(updatedCheckedState);
    };

    // when the button is pressed
    const doSearch = useCallback(() => {
        const searchOptions = {
            similarity_type: ranking,
            num_results: numResults,
            collections_to_search: collectionList.filter(
                (element, index) => collections[index]
            ).join(" ")
        };
        setSearchParams(searchOptions);
    }, [collections, numResults, ranking, setSearchParams]);

    const paramCollections = searchParams.get('collections_to_search');
    const paramNumResults = searchParams.get('num_results');
    const paramSimilarityType = searchParams.get('similarity_type');
    const {readyToSearch, onSearch} = props;

    useEffect(() => {
        // Check that the search parameters are valid and if they are,
        // perform a search
        const validNumResults = numResultsTypes.map((r) => r.value);
        const validRanking = rankingTypes.map((r) => r.value);

        let isGood = true;
        // If any parameter is invalid, clear them all
        if (paramNumResults && !validNumResults.includes(paramNumResults)) {
            isGood = false;
            console.log('set search params empty - bad num results');
            setSearchParams({});
            return;
        } else if (paramNumResults) {
            console.log('set numresults');
            setNumResults(paramNumResults);
        }

        if (paramSimilarityType && !validRanking.includes(paramSimilarityType)) {
            isGood = false;
            console.log('set search params empty - bad similarity');
            setSearchParams({});
            return;
        } else if (paramSimilarityType) {
            console.log('set similairty ');
            setRanking(paramSimilarityType);
        }

        let goodCollections = true;
        let collectionsToSet: boolean[] = [];
        const paramCollectionParts = paramCollections?.split(" ");
        if (paramCollectionParts) {
            paramCollectionParts.forEach((col) => {
                if (col && !collectionList.includes(col)) {
                    goodCollections = false;
                    isGood = false;
                    console.log('set search params empty - bad collections');
                    setSearchParams({});
                    return;
                }
            });
            if (goodCollections) {
                collectionsToSet = collectionList.map((col) => {
                    return paramCollectionParts.includes(col);
                });
                console.log('set collections', collectionsToSet);
                setCollections(collectionsToSet);
            }
        }
        console.log(`is goof? ${isGood}`);
        if (isGood && readyToSearch) {
            onSearch({
                similarity_type: paramSimilarityType,
                num_results: paramNumResults,
                collections_to_search: collectionList.filter(
                    (element, index) => collectionsToSet[index]
                )
            });
        }
    }, [paramCollections, paramNumResults, paramSimilarityType, setSearchParams, readyToSearch, onSearch]);

    return <>
        <Form.Group as={Row} className="mb-3" controlId="form-result-ranking">
            <Form.Label column sm={4}>Result Ranking</Form.Label>
            <Col>
                <Form.Select value={ranking} onChange={
                    (e) => setRanking(e.currentTarget.value)
                }>
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
    </>;
};

export default SearchOptions;
