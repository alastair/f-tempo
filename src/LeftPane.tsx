import {Button, ButtonGroup, Row} from "react-bootstrap";
import ImageView from "./ImageView";
import {CurrentPageData} from "./FTempo";
import {useCallback, useEffect} from "react";
import {useNavigate} from "react-router-dom";

type LeftPaneProps = {
    page: CurrentPageData;
}

const LeftPane = (props: LeftPaneProps) => {
    const navigate = useNavigate();

    const change_book = useCallback((direction: 'next'|'prev') => {
        fetch(`/api/next_id?direction=${direction}&library=${props.page.library}&book=${props.page.book}`).then(r =>
            r.json()
        ).then(response => {
            navigate(`/ftempo/${response.data.library}/${response.data.book_id}/${response.data.page.id}`);
        });
    }, [navigate, props.page.book, props.page.library]);

    const change_page = useCallback((direction: 'next'|'prev') => {
        fetch(`/api/next_id?direction=${direction}&library=${props.page.library}&book=${props.page.book}&page=${props.page.id}`).then(r =>
            r.json()
        ).then(response => {
            navigate(`/ftempo/${response.data.library}/${response.data.book_id}/${response.data.page.id}`);
        });
    }, [navigate, props.page.book, props.page.id, props.page.library]);

    const change_random_page = useCallback(() => {
        fetch(`/api/random_id`).then(r =>
            r.json()
        ).then(response => {
            navigate(`/ftempo/${response.library}/${response.book}/${response.id}`);
        });
    }, [navigate]);

    // Navigation for next/prev page/book
    useEffect(() => {
        const downHandler = (event: KeyboardEvent) => {
            if ([37, 39].indexOf(event.keyCode) > -1) {
                event.preventDefault();
            }
            const shiftDown = event.shiftKey;
            if (event.keyCode === 37) {
                // left arrow
                if (shiftDown) {
                    change_book("prev");
                } else {
                    change_page("prev");
                }
            } else if (event.keyCode === 39) {
                // right arrow - Search next page/book
                if (shiftDown) {
                    change_book("next");
                } else {
                    change_page("next");
                }
            } else if (event.keyCode === 220) {
                // '\' for random query
                change_random_page();
            }
        };
        window.addEventListener("keydown", downHandler);
        return () => {
            window.removeEventListener("keydown", downHandler);
        };
    }, [change_book, change_page, change_random_page]);

    return (<>
        <Row>
            <ButtonGroup>
                <Button variant="outline-secondary" size="sm" onClick={() => {change_book("prev");}}>Previous Book</Button>&nbsp;
                <Button variant="outline-secondary" size="sm" onClick={() => {change_page("prev");}}>Previous Page</Button>&nbsp;
                <Button variant="outline-secondary" size="sm" onClick={change_random_page}>Random Page</Button>&nbsp;
                <Button variant="outline-secondary" size="sm" onClick={() => {change_page("next");}}>Next Page</Button>&nbsp;
                <Button variant="outline-secondary" size="sm" onClick={() => {change_book("next");}}>Next Book</Button>
            </ButtonGroup>
        </Row>
        <Row>
            <ImageView page={props.page} />
        </Row>
    </>);
};

export default LeftPane;
