import {Button, ButtonGroup, Row} from "react-bootstrap-v5";
import ImageView from "./ImageView";

const LeftPane = () => {
    return (<><Row>
        <ButtonGroup>
            <Button variant="outline-secondary" size="sm">Previous Book</Button>&nbsp;
            <Button variant="outline-secondary" size="sm">Previous Page</Button>&nbsp;
            <Button variant="outline-secondary" size="sm">Random Page</Button>&nbsp;
            <Button variant="outline-secondary" size="sm">Next Page</Button>&nbsp;
            <Button variant="outline-secondary" size="sm">Next Book</Button>
        </ButtonGroup>
    </Row>
    <Row>
        <ImageView />
    </Row></>);
};

export default LeftPane;
