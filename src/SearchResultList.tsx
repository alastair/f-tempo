import {useCallback, useEffect, useState} from "react";
import {ProgressBar} from "react-bootstrap";
import {CurrentPageData} from "./FTempo";
import {useLocation} from "react-router-dom";

type SearchResultProps = {
    currentPage?: CurrentPageData
    results: any;
    onSelectResult: (resultIndex: number) => void;
}

const SearchResultList = (props: SearchResultProps) => {
    const location = useLocation();
    const locationHash = location.hash.replace('#', '');
    const locationSelectedIndex = Number(locationHash);
    const [selectedResult, setSelectedResult] = useState(Number.isInteger(locationSelectedIndex) ? locationSelectedIndex : 0);

    const setResultCallback = useCallback((selectedResult: number) => {
        setSelectedResult(selectedResult);
    }, []);

    const {onSelectResult, results} = props;

    useEffect(() => {
        onSelectResult(selectedResult);
        location.hash = `#${selectedResult}`;
    }, [onSelectResult, selectedResult]);

    useEffect(() => {
        function downHandler(event: any): void {
            if ([38, 39].indexOf(event.keyCode) > -1) {
                event.preventDefault();
            }
            if (event.keyCode === 38) {    // up arrow
                if (selectedResult > 0) {
                    setResultCallback(selectedResult - 1);
                    //props.onSelectResult(selectedResult - 1);
                }
            } else if (event.keyCode === 40) {    // down arrow
                if (selectedResult < results.length - 1) {
                    setResultCallback(selectedResult + 1);
                    //props.onSelectResult(selectedResult + 1);
                }
            }
        }
        window.addEventListener("keydown", downHandler);
        return () => {
            window.removeEventListener("keydown", downHandler);
        };
    }, [results.length, selectedResult, setResultCallback]);

    return <table>
        <thead>
            <tr>
                <th />
                <th>Page ID</th>
                <th>Match Score</th>
                <th />
            </tr>
        </thead>
        <tbody>
            {props.results.map((result: any, index: number) => {
                const percent = 100 - result.jaccard * 100;
                const progress = Number.parseFloat(String(percent)).toFixed(2);
                let compare = <></>;
                console.log('result!');
                console.log(result);
                console.log(props.currentPage);

                if (props.currentPage && props.currentPage.id !== result.id) {
                    const cp = props.currentPage;
                    const url = `/compare?qlib=${cp.library}&qbook=${cp.book}&qid=${cp.id}&mlib=${result.library}&mbook=${result.book}&mid=${result.id}`;
                    compare = <img alt="compare query and result"
                        width='16' height='16' src='/img/magnifying-glass.svg'
                        onClick={() => {
                            window.open(url, "_blank",
                                'width=1200, \
                                 height=600, \
                                 directories=no, \
                                 location=no, \
                                 menubar=no, \
                                 resizable=no, \
                                 scrollbars=1, \
                                 status=no, \
                                 toolbar=no');
                        }}
                    />;
                }
                return <tr
                    key={result.id}
                    onClick={() => setResultCallback(index)}
                    style={{backgroundColor: selectedResult === index ? "lightpink" : "white",
                        cursor: "pointer"
                    }}>
                    <td />
                    <td>{result.id}</td>
                    <td><ProgressBar now={percent} label={progress} /></td>
                    <td>{compare}</td>
                </tr>;
            })}
        </tbody>
    </table>;
};

export default SearchResultList;
