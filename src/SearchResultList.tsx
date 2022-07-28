import {useEffect} from "react";
import {ProgressBar} from "react-bootstrap";
import {CurrentPageData} from "./FTempo";

type SearchResultProps = {
    currentPage: CurrentPageData
    results: any;
    selectedResult: number
    onSelectResult: (resultIndex: number) => void;
}

const SearchResultList = (props: SearchResultProps) => {
    useEffect(() => {
        function downHandler(event: any): void {
            if ([38, 39].indexOf(event.keyCode) > -1) {
                event.preventDefault();
            }
            if (event.keyCode === 38) {    // up arrow
                if (props.selectedResult > 0) {
                    props.onSelectResult(props.selectedResult - 1);
                }
            } else if (event.keyCode === 40) {    // down arrow
                if (props.selectedResult < props.results.length - 1) {
                    props.onSelectResult(props.selectedResult + 1);
                }
            }
        }
        window.addEventListener("keydown", downHandler);
        return () => {
            window.removeEventListener("keydown", downHandler);
        };
    }, [props]);

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

                if (props.currentPage.id !== result.id) {
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
                    onClick={() => props.onSelectResult(index)}
                    style={{backgroundColor: props.selectedResult === index ? "lightpink" : "white",
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
