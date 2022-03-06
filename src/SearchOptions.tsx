import {useState} from "react";
import {Button, ButtonToolbar, Col, Form, Row} from "react-bootstrap-v5";

type SelectOptions = {
    value: string
    label: string
}

const searchTypes: SelectOptions[] = [
    {value: 'maw', label: 'Minimum Absent Words'},
    {value: 'ngram', label: '5-Grams'}
];

const rankingTypes: SelectOptions[] = [
    {value: 'jaccard', label: 'Jaccard Distance'},
    {value: 'basic', label: 'Basic'},
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
};

const SearchOptions = (props: SearchOptionsProps) => {
    const [searchType, setSearchType] = useState('maw');
    const [ranking, setRanking] = useState('jaccard');
    const [numResults, setNumResults] = useState('10');
    const [provideFeedback, setProvideFeedback] = useState(false);
    const [collections, setCollections] = useState(new Array(collectionList.length).fill(true));

    const handleCollectionTick = (position: number) => {
        const updatedCheckedState = collections.map((item, index) =>
            index === position ? !item : item
        );
        setCollections(updatedCheckedState);
    };

    const doSearch = () => {
        props.onSearch({
            similarity_type: ranking,
            num_results: numResults,
            collections_to_search: collectionList.filter(
                (element, index) => collections[index]
            )
        });
    };

    return <>
        <Form.Group as={Row} className="mb-3" controlId="form-search-type">
            <Form.Label column sm={4}>Search Type</Form.Label>
            <Col>
                <Form.Select value={searchType} onChange={
                    (e) => setSearchType(e.currentTarget.value)
                }>
                    {searchTypes.map(st => {
                        return <option key={st.value} value={st.value}>{st.label}</option>;
                    })}
                </Form.Select>
            </Col>
        </Form.Group>
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
        <Form.Group as={Row} className="mb-3" controlId="form-provide-responses">
            <Col>
                <Form.Check type={"checkbox"}
                    id={"form-provide-responses-check"}
                    label={"Provide judgements to help improve the system"}
                    checked={provideFeedback}
                    onChange={() => setProvideFeedback(!provideFeedback)}
                />
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
