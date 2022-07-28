import {Table} from "react-bootstrap";
import Skeleton from "react-loading-skeleton";
import 'react-loading-skeleton/dist/skeleton.css';

type SearchResultProps = {
    numResults: number;
}

const FakeSearchResultList = (props: SearchResultProps) => {
    return <Table>
        <thead>
            <tr>
                <th colSpan={4}>
                    <Skeleton width={`80%`}/>
                </th>
            </tr>
            <tr>
                <th style={{width: `37px`}} />
                <th><Skeleton width={`80%`} /></th>
                <th style={{width: `200px`}}><Skeleton width={`80%`} /></th>
                <th style={{width: `30px`}} />
            </tr>
        </thead>
        <tbody>
            {Array.from(Array(props.numResults)).map((x, i) => {
                // Make the top results look like they're going from 100% match, down a bit each item, and then
                // the last items are all low-results
                const width = i < 5 ? 100 - 10 * i : 20;
                return <tr key={i}>
                    <td></td>
                    <td><Skeleton /></td>
                    <td><Skeleton width={`${width}%`} /></td>
                    <td>{i > 0 && <Skeleton width={`20px`} />}</td>
                </tr>;
            })
            }
        </tbody>
    </Table>;
};

export default FakeSearchResultList;
