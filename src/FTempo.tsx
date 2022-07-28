import {Col, Row} from "react-bootstrap-v5";
import LeftPane from "./LeftPane";
import SearchOptions from "./SearchOptions";

const FTempo = () => {

    const onDoSearch = (searchOptions: any) => {
        console.debug("searcH!");
        console.debug(searchOptions);
    };

    return <Row>
        <Col><LeftPane/></Col>
        <Col md={3}><SearchOptions onSearch={onDoSearch}/></Col>
        <Col>c</Col>
    </Row>;
};

export default FTempo;
