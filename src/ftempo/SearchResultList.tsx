import {useCallback, useEffect} from "react";
import {ProgressBar, Table} from "react-bootstrap";
import {CurrentPageData} from "../ApiClient";
import {useLocation, useNavigate} from "react-router-dom";

type SearchResultProps = {
    currentPage?: CurrentPageData
    results: any;
    onSelectResult: (resultIndex: number) => void;
}

const SearchResultList = (props: SearchResultProps) => {
    const location = useLocation();
    const hash = location.hash.replace('#', '');
    const hashNumber = Number(hash);
    const navigate = useNavigate();

    const setResultCallback = useCallback((selectedResult: number) => {
        navigate(location.pathname + location.search + `#${selectedResult}`);
    }, [navigate, location.pathname, location.search]);

    const {onSelectResult, results} = props;

    useEffect(() => {
        if (hash === '') {
            // No hash, add one
            navigate(location.pathname + location.search + `#1`);
        } else if (Number.isInteger(hashNumber)) {
            // Hash is set and is a number, select the result
            onSelectResult(hashNumber - 1);
        } else {
            // Hash is set but isn't a number, go back to result 1
            navigate(location.pathname + location.search + `#1`);
        }
    }, [onSelectResult, hash, hashNumber, navigate, location.pathname, location.search]);

    // TODO: enter to search
    // TODO: Left/right move l/r based on selected item
    useEffect(() => {
        function downHandler(event: any): void {
            if ([38, 40].indexOf(event.keyCode) > -1) {
                event.preventDefault();
            }
            if (event.keyCode === 38) {    // up arrow
                if (hashNumber > 1) {
                    setResultCallback(hashNumber - 1);
                }
            } else if (event.keyCode === 40) {    // down arrow
                if (hashNumber < results.results.length) {
                    setResultCallback(hashNumber + 1);
                }
            }
        }
        window.addEventListener("keydown", downHandler);
        return () => {
            window.removeEventListener("keydown", downHandler);
        };
    }, [results.results.length, hashNumber, setResultCallback]);

    return <Table>
        <thead>
            <tr><th colSpan={4}>{results.results.length} results &mdash; {results.numQueryWords} words in query</th></tr>
            <tr>
                <th style={{width: `37px`}} />
                <th>Page ID</th>
                <th style={{maxWidth: `200px`}}>Match Score</th>
                <th style={{width: `30px`}} />
            </tr>
        </thead>
        <tbody>
            {props.results.results.map((result: any, index: number) => {
                const percent = 100 - result.jaccard * 100;
                const progress = Number.parseFloat(String(percent)).toFixed(2);
                let compare = <></>;
                let titlePage = <></>;

                if (props.currentPage && props.currentPage.page_id !== result.id) {
                    const cp = props.currentPage;
                    const url = `/compare?qlib=${cp.library}&qbook=${cp.book_id}&qid=${cp.page_id}&mlib=${result.library}&mbook=${result.book}&mid=${result.id}`;
                    compare = <img alt="compare query and result"
                        width='16' height='16' src='/img/magnifying-glass.svg'
                        onClick={() => {
                            window.open(url, "_blank",
                                'width=1200, height=600, directories=no, location=no, menubar=no, resizable=no, scrollbars=1, status=no, toolbar=no');
                        }}
                    />;
                }
                if (result.titlepage) {
                    titlePage = <img src="/img/tp_book.svg" alt="View the title page for this result's book" height="20" />;
                }
                return <tr
                    key={result.id}
                    onClick={() => setResultCallback(index + 1)}
                    style={{backgroundColor: hashNumber === index + 1 ? "lightpink" : "white",
                        cursor: "pointer"
                    }}>
                    <td>{titlePage}</td>
                    <td>{result.id}</td>
                    <td><ProgressBar now={percent} label={progress} /></td>
                    <td>{compare}</td>
                </tr>;
            })}
        </tbody>
    </Table>;
};

export default SearchResultList;
