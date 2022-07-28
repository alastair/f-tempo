import {CurrentPageData} from "./FTempo";

type ImageViewProps = {
    page: CurrentPageData;
}

const ImageView = (props: ImageViewProps) => {
    return <div><img src={`https://uk-dev-ftempo.rism.digital/img/jpg/${props.page.id}.jpg`} alt="x" style={{width: "100%"}} /></div>;
};

export default ImageView;
