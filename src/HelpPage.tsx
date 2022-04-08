import {Container} from "react-bootstrap";

const HelpPage = () => {
    return (
        <Container fluid="lg">
            <h2>About Early Music Online Search</h2>
            <p>Early Music Online (EMO) was originally (July 2018) based on a collection of digital images of 16c
                printed music from the British Library (GB-Lbl). At that time the interface provided content-based
                search to about 32,000 pages from just under 200 of these books. Since then, it has been
                considerably expanded, to include about the same number of images from other European music
                libraries, such as the Bibliothèque nationale in Paris (F-Pn), the Berlin Staatsbibliothek (D-Bsb)
                and the Polish National Library in Warsaw (PL-Wn). We have now further incorporated almost
                half-a-million pages from the Bayerische Staatsbibliothek in Munich (D-Mbs).
            </p>
            <p>
                The images have been subjected to optical music recognition using <a href="https://www.verovio.org/">Aruspix</a>, and the musical contents indexed for efficient searching
                using a <a href="http://doc.gold.ac.uk/~mas01tc/ISMIR2018_draft.pdf" rel="noreferrer" target="_blank">state-of-the-art
                method</a>.
            </p>
            <p>
                This interface simply allows searches for pages containing music similar to that contained in a query
                page. It does not yet allow searching for an arbitrary musical sequence of notes, though this is planned
                for a future version. Also, it makes no use of library metadata - information about the books (titles,
                composers, printers, dates, places, etc.); this, too, will be incorporated in a later version.
            </p>
            <p>
                Enquiries to <a href="mailto:t.crawford@gold.ac.uk?Subject=EMO%20Search%20Enquiry" target="_top">Tim Crawford</a>
            </p>
            <h2> Queries - Search box</h2>
            <p>
                When you open this page, you will see the image of a single page from a book in the collection on
                the left. You can easily move through books and pages in the collection (see Navigation for more
                details), but to explore the collection, it will probably be easier to start with a Random
                Search.</p>
            <p>
                The left/right
                arrow-keys can be used to navigate to and search the previous/next page. You can also skip to the
                first page of the previous/next book by holding down the shift key as you click on the respective
                arrows.
            </p>
            <p>
            To perform a search, simply hit the Enter or Return key, or click on the Search button. (The button
            called 'Repeat last Search' does what it says, but not in an intelligent way - we intend to improve this
            in future.)
            </p>
            <h2> Random Search</h2>
            <p>
                This simply chooses a page at random from the entire collection. You can use the backslash ('\') as
                a keyboard shortcut. Be warned, if this leads to a page that contains little or no music (as is
                often the case - again, we intend to improve this) a search will not result in any meaningful
                results!
            </p>
            <h2> Feedback - Relation to query</h2>
            <p>
                You can provide feedback concerning the nature of a result by entering your own judgements. To do
                this, before doing a search check the box marked &ldquo;Provide judgements to help improve the
                system&rdquo;. The result list will then contain drop-down menus which you can use to enter your
                judgements. </p>
            <p> You are not obliged to do this, but all feedback is saved (anonymously) on the server and will be
                used in future for refining the way the interface operates (e.g. by initially eliminating non-music
                pages). This will be enormously useful to us, and it takes very little time. By activating
                the &ldquo;Provide judgements&rdquo; menus we assume you are giving your consent. There is no way we
                can trace back the information saved by us to you.</p><p>
                The first result should always be the query itself (unless you have uploaded an image for searching -
                see below under 'Uploading an image'), but this may be a page which doesn't contain any music (e.g. a
                title-page, or just text, or an image) - in which case, choose 'Not music!'. For all other results, do
                the same if the page does not contain music. Otherwise, choose from the categories 'Duplicate page'
                (where it is an extra copy of the same page), 'Same music' (from a different book or edition) or
                'Related music' (which might be from a different voice-part, or a different section of a work). Use your
                own judgement about these decisions, as it is difficult to establish hard and fast rules for the last
                case in particular.
            </p>
            <p>
            If you make a mistake, simply re-do it immediately - all feedback is time-stamped, so we will know if a
            change has been made within a short time.
            </p>
            <h2> Result ranking</h2>
            <p>
                Basically, matches are made by finding the pages with the maximum 'overlap' with the query. However,
                this means that pages containing a lot of notes are more likely to contain such overlaps by
                accident.
            </p>
            <p>
                There are two 'modes' for ranking results. The 'Basic' mode takes no account of the number of notes on a
                page, which can lead to false matches with long pages. The default 'Jaccard' mode, however, uses the
                <a href="https://www.statisticshowto.com/jaccard-index" rel="noreferrer" target="_blank">Jaccard distance</a> measure
                instead, which tends on the whole to give better results.</p><p>
                When you change this setting by choosing from the &ldquo;Result Ranking&rdquo; menu your search will be
                re-run.
                (NB At present this choice is disabled, and only the 'Jaccard' mode is available.)
            </p>
            <h2> Results to display</h2>
            <p>
                You can choose a number of results to display, or 'Best matches', which simply shows our estimate of
                the best results to be found. Caveat: Very occasionally an interesting match can be found below this
                threshold (e.g. when the music is only fleetingly similar), but it is hard to predict when this
                might occur, so you might find it interesting to explore these options.
            </p>
            <p>
                When you change this setting by choosing from the &ldquo;Result Ranking&rdquo; menu your search will be
                re-run.
                (NB At present this choice is disabled, and the 'Best matches' option is unavailable. We intend to
                restore this option soon. Be aware that there are many ways to filter the 'best' matches, so the above
                caveat will continue to apply)
            </p>
            <h2> Uploading an image</h2>
            <p>
                If you click on &ldquo;Search with Image Upload&rdquo; in the page header, you will be able to
                upload your own query page in one of a variety of common graphics formats. On clicking &ldquo;Upload
                and Search&rdquo; your image will be uploaded to our server (which will usually take a few extra
                seconds, depending on the speed of your internet connection), recognised and encoded as a query
                which is then run against the database, and the result list presented as usual. <br />(NB This is an
                experimental feature which has not been exhaustively tested, and may produce an error message from
                time to time. It will also give nonsense results if the page-image uploaded is not of music!)
            </p>
            <h2> Navigation with arrow keys</h2>
            <p>
                As well as using the left/right arrow keys to search the previous/next page, with the shift key to
                move between books, you can move up and down the results list using the up and down arrow keys. As
                you do so, the relevant result-image will be displayed on the right, together with its ID and some
                information about the match.<br />
                As you move the cursor over the query image (left) or match image (right) it will be displayed at
                high magnification to show detail. To avoid this behaviour simply move the mouse away from the
                image.
            </p>
            <h2> Comparing result with query</h2>
            <p>
                In order to gain some feeling for the quality of the recognition, and the nature and extent of a
                match, you can see a visualisation of the matched sequences of notes superimposed on the original
                image. Simply click on the 'magnifying glass' displayed on the right of the result-list. This will
                bring up a new window displaying the two pages side-by-side; this will take a few extra seconds to
                display, since it uses a different mechanism to verify the match. Sometimes, one or other of the
                pages lacks the necessary data for the comparison, in which case an error message is shown.</p><p>
                NB: Results generated by a search with an uploaded image currently lack the data necessary for this
                parallel display; we intend to include this data for all pages in the near future.
            </p>
            <h2> Book title-pages</h2>
            <p>
                Where the system has a stored 'thumbnail' image of a book's title-page (as is the case for all the
                books from the Munich collection) you can view it by clicking on the 'open-book' button to the left
                of a result. NB Some books do not have title-pages in a library's copy; in this case, the first page
                of music is usually displayed.
            </p>
            <p>
                We intend in a future version to incorporate proper metadata (titles, authors, printers, places,
                dates, etc.) as supplied by the libraries, which will be displayed on request within this interface.
            </p>
        </Container>
    );
};

export default HelpPage;