import {Button, Col, Row} from "react-bootstrap-v5";
import ImageView from "./ImageView";

const LeftPane = () => {
    return (<><Row>
        <Col><Button>Previous Book</Button></Col>
        <Col><Button>Previous Page</Button></Col>
        <Col><Button>Random Page</Button></Col>
        <Col><Button>Next Page</Button></Col>
        <Col><Button>Next Book</Button></Col>
    </Row>
    <Row>
        <ImageView />
    </Row></>);
};

export default LeftPane;
