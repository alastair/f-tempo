import {Card, Col, Row} from "react-bootstrap";
import { Link } from "react-router-dom";


function ExampleLoader() {
    const examples = [
        {library: 'GB-Lbl', book: 'K2h7', id: 'GB-Lbl_K2h7_092_1', desc: <>Different editions of Berchem, 'O s'io potessi donna' (<i>Cantus</i>)</>},
        {library: 'GB-Lbl', book: 'A360a', id: 'GB-Lbl_A360a_005_0', desc: <>Very different editions of Striggio, 'Alma reale' (<i>Canto</i>)</>},
        {library: 'GB-Lbl', book: 'K3k19', id: 'GB-Lbl_K3k19_012_1', desc: <>Lassus, 'Susanna faire' (<i>Cantus</i>) and the original French chanson</>},
        {library: 'GB-Lbl', book: 'K3k19', id: 'GB-Lbl_K3k19_014_0', desc: <>Marenzio, 'I must depart all haples' (<i>Cantus</i>), and: (a) the original Italian madrigal; (b) the <i>Quinto</i> part of the latter, split between nos. 13 and 14</>},
        {library: 'GB-Lbl', book: 'A324', id: 'GB-Lbl_A324c_048_1', desc: <>Nanino, 'Morir non puo'l mio core' (<i>Alto</i>) and the English version (<i>Contratenor</i>) - note the two extra notes at the beginning! There is also a Latin contrafactum at no. 6</>},
        {library: 'GB-Lbl', book: 'K3k12', id: 'GB-Lbl_K3k12_010_0',  desc: <>Marenzio, 'Sweet hart arise' (<i>Superius</i>), and the English version (<i>Canto</i>); the Italian <i>Quinto</i> part is ranked at 15 - you can increase the number of results using the dropdown.</>},
        {library: 'GB-Lbl', book: 'K9a10', id: 'GB-Lbl_K9a10_023_0', desc: <>Morales, 'Magnificat Sexti toni' (choirbook); ranks 2 & 3 are different voice-parts from the work</>},
        {library: 'GB-Lbl', book: 'A19', id: 'GB-Lbl_A19_004_0',    desc: <>End of Clemens non Papa, 'Pater peccavi' and beginning of its <i>Secunda pars</i>, 'Quanti mercanarii' (<i>Tenor</i>); 'Pater peccavi' is at rank 2</>},
        {library: 'GB-Lbl', book: 'K3e1', id: 'GB-Lbl_K3e1_061_1',  desc: <>Clemens non Papa, 'Angelus domini' (<i>Bassus</i>); other editions at ranks 2 to 6, and 9; <i>Tenor</i> part at ranks 7 to 8, and 10; another edition of <i>Bassus</i> at rank 5</>},
        {library: 'GB-Lbl', book: 'K2a4', id: 'GB-Lbl_K2a4_072_1',  desc: <>Lassus, Psalm 11, 'Pourquoy font bruit' (<i>Contratenor</i>), and the chanson on which it is based, 'Las me faut', ranked at 2; at ranks 3 & 4 are the two pages of another edition of the chanson</>},
        {library: 'GB-Lbl', book: 'A569c', id: 'GB-Lbl_A569c_024_0', desc: <>Willaert, 'Recercar quinto', was also published in a transposed version  (GB-Lbl_K3b4_013_0) as well as at the original pitch (GB-Lbl_K3b4_020_0)</>},
        {library: 'GB-Lbl', book: 'K8f10', id: 'GB-Lbl_K8f10_134_1', desc: <>Anonymous <i>lauda</i>, 'Ecco care sorelle' (<i>Cantus</i> and <i>Tenor</i> parts on same page!) is actually a close version of Verdelot, 'Fedel' e bel cagnuolo' (<i>Cantus</i> at rank 2; <i>Tenor</i> at rank 3)</>},
        {library: 'GB-Lbl', book: 'A569c', id: 'GB-Lbl_A569c_013_1', desc: <>'Recercar undecimo' (<i>Canto</i>), by <i>Incerto Autore</i>; at rank 2 is Damianus, 'In die tribulationis' (scholars disagree about the identity of this composer); <i>Basso</i> part of the recercar at rank 3</>},
        {library: 'D-Bsb', book: 'Parangon_03', id: 'D-Bsb_Parangon_03_1543_inv_060_0', desc: <>Arcadelt, 'Vous perdez temps' (Tenor); turns out to be musically identical to his madrigal, 'Non ch'io, non voglio' (K2h3_031_1)</>},
    ];

    return <Row>
        <Col sm={2}/><Col sm={6}>
            {examples.map((ex: any) => {
                return <>
                    <Card style={{flexDirection: "row"}}>
                        <Card.Img style={{width: "120px"}} variant="top" src={`https://uk-dev-ftempo.rism.digital/img/jpg/${ex.id}.jpg`} />
                        <Card.Body>
                            <Card.Text><Link to={`/ftempo/${ex.library}/${ex.book}/${ex.id}`}>{ex.desc}</Link></Card.Text>
                        </Card.Body>
                    </Card><br />
                </>;
            })
            }
        </Col>
    </Row>;
}

export default ExampleLoader;