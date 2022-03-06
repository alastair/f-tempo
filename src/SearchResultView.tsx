
type ResultType = {
    id: string;
    book: string;
    library: string;
    score: number;
    codestring: string;
    num_matched_words: number;
    num_words: number;
    jaccard: number;
}

type SearchResultViewProps = {
    result: ResultType;
}

const SearchResultView = (props: SearchResultViewProps) => {
    return <div>
        <img
            src={`https://uk-dev-ftempo.rism.digital/img/jpg/${props.result.id}.jpg`}
            alt="x"
            style={{width: "100%"}} />
    </div>;
};

export default SearchResultView;
