import {Button, ButtonGroup, Row} from "react-bootstrap";
import ImageView from "./ImageView";
import {CurrentPageData} from "../ApiClient";
import {useCallback, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useApiClient} from "../App";

type LeftPaneProps = {
    page: CurrentPageData;
}

const LeftPane = (props: LeftPaneProps) => {
    const navigate = useNavigate();
    const apiClient = useApiClient();

    const change_book = useCallback((direction: 'next'|'prev') => {
        apiClient.changeBook(direction, props.page.library, props.page.book_id).then(page => {
            navigate(`/ftempo/${page.library}/${page.book_id}/${page.page_id}`);
        });
    }, [apiClient, navigate, props.page.book_id, props.page.library]);

    const change_page = useCallback((direction: 'next'|'prev') => {
        apiClient.changePage(direction, props.page.library, props.page.book_id, props.page.page_id).then(page => {
            navigate(`/ftempo/${page.library}/${page.book_id}/${page.page_id}`);
        });
    }, [apiClient, navigate, props.page.book_id, props.page.library]);

    const change_random_page = useCallback(() => {
        apiClient.randomPage().then(page => {
            navigate(`/ftempo/${page.library}/${page.book_id}/${page.page_id}`);
        });
    }, [apiClient, navigate]);

    // Navigation for next/prev page/book
    useEffect(() => {
        const downHandler = (event: KeyboardEvent) => {
            if ([37, 39, 220].indexOf(event.keyCode) > -1) {
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
