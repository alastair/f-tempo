import {useEffect} from "react";
import {ProgressBar} from "react-bootstrap-v5";

type SearchResultProps = {
    results: any;
    selectedResult: number
    onSelectResult: (resultIndex: number) => void;
}

const SearchResultList = (props: SearchResultProps) => {
    useEffect(() => {
        function downHandler(event: any): void {
            if ([13, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
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
                <th></th>
                <th>Page ID</th>
                <th>Match Score</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {props.results.map((result: any, index: number) => {
                const percent = 100 - result.jaccard * 100;
                const progress = Number.parseFloat(String(percent)).toFixed(2);
                return <tr
                    key={result.id}
                    onClick={() => props.onSelectResult(index)}
                    style={{backgroundColor: props.selectedResult === index ? "lightpink" : "white",
                        cursor: "pointer"
                    }}>
                    <td></td>
                    <td>{result.id}</td>
                    <td><ProgressBar now={percent} label={progress} /></td>
                    <td></td>
                </tr>;
            })}
        </tbody>
    </table>;
};

export default SearchResultList;
