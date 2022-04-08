import fs from 'fs';
import os from 'os';
import solr from 'solr-client';
import nconf from 'nconf';
import {get_maws_for_codestrings} from "../../lib/maw.js";
import * as path from "path";
import fileUpload from "express-fileupload";
import {pageToContourList, parseMeiData} from "../../lib/mei.js";
import {db} from "../server.js";
import { perform_omr_image } from './omr.js';


type SubsequenceSearchResponse = {
    id: string
    siglum: string
    library: string
    book: string
    page_number: string
    notes: string
    intervals: string
    maws: string
    page_data: string
}

type SubsequenceResponseNote = {
    p: string
    o: string
    id: string
    x: string
}

type SubsequenceResponseSystem = {
    id: string
    notes: SubsequenceResponseNote[]
}

type SubsequenceResponsePage = {
    width: string
    height: string
    systems: SubsequenceResponseSystem[]
}


/**
 * The same as String.prototype.indexOf, but works on arrays instead of strings
 * @param arr the array to search
 * @param subarr the subarray to find
 * @param startat the starting position in arr to search
 */
function findSubarray(arr: string[], subarr: string[], startat: number) {
    // TODO: This could be updated to use something like KMP to be faster
    for (let i = startat; i < 1 + (arr.length - subarr.length); i++) {
        let j = 0;
        for (; j < subarr.length; j++) {
            if (arr[i + j] !== subarr[j]) {
                break;
            }
        }
        if (j === subarr.length) {
            return i;
        }
    }
    return -1;
}

function quote(str: string) {
    return `"${str}"`;
}

async function get_maws_for_siglum(siglum: string) {
    const client = solr.createClient(nconf.get('search'));
    const query = client.query().q('siglum:' + quote(siglum)).fl('maws');
    const result = await client.search(query);
    if (result.response.numFound >= 1) {
        const doc = result.response.docs[0];
        return (doc as any).maws;
    } else {
        return "";
    }
}

export class UnknownSearchTypeError extends Error {
    constructor() {
        super("Unknown search type, must be one of 'boolean', 'solr', or 'jaccard'");
    }
}

/**
 * 
 * @param maws A list of maws
 * @param collections_to_search A list of collections/libraries to search
 * @param num_results how many results to return
 * @param boolean_sim if true, use solr's BooleanSimilarity instead of BM25
 * @returns 
 */
async function search_maws_solr(maws: string[], collections_to_search: string[], num_results: number, similarity_type: 'boolean'|'jaccard'|'solr'): Promise<any> {
    maws = maws.map(quote);
    collections_to_search = collections_to_search.map(quote)
    const client = solr.createClient(nconf.get('search'));
    const fields: {maws_boolean?: number, maws?: number} = {};
    let query :any;
    if (similarity_type === 'boolean') {
        const fieldname = "maws_boolean";
        query = client.query().q(`${fieldname}: (${maws.join(" ")})`).fl('*,score').rows(num_results);
    } else if (similarity_type === 'solr') {
        const fieldname = "maws";
        query = client.query().q(`${fieldname}: (${maws.join(" ")})`).fl('*,score').rows(num_results);
    } else if (similarity_type === 'jaccard') {
        // If we know the number of items in the search term, we can get solr to compute jaccaard itself and
        // sort by it:
        //  div(query($q), sub(add(nummaws, 270), query($q))) desc
        // $q is a solr variable based on the ?q parameter, and query() re-runs a query. This has the effect
        // of returning the "score", which is the number of matching elements (intersection)
        // we know the list of maws is unique, so we can compute set union by nummawsA + nummawsB - intersection
        // store the number of maws in each doc in the 'nummaws' field, count the number of maws in the
        // search query in js, and re-compute $q again for the number in intersection again
        const sortparam = `div(query($q), sub(add(nummaws, ${maws.length}), query($q)))`;
        let sortquery: Record<string, any> = {[sortparam]: "desc"}
        const fieldname = "maws_boolean";
        query = client.query().q(`${fieldname}: (${maws.join(" ")})`).fl(`*,score,jaccard:${sortparam}`).sort(sortquery).rows(num_results);
    } else {
        throw new UnknownSearchTypeError();
    }

    if (collections_to_search.length) {
        query = query.matchFilter("library", "(" + collections_to_search.join(" OR ") + ")")
    }
    query = query.matchFilter("-notmusic", "true");
    const result = await client.search(query!);
    if (result.response.numFound >= 1) {
        return result.response.docs;
    }
    return []
}

async function search_subsequences_solr(subsequence: string, collections_to_search: string[], num_results: number, interval: boolean): Promise<any> {
    collections_to_search = collections_to_search.map(quote)
    const client = solr.createClient(nconf.get('search'));
    const qob = interval ? {intervals: quote(subsequence)} : {notes: quote(subsequence)}
    let query = client.query().q(qob).rows(num_results);
    if (collections_to_search.length) {
        query = query.matchFilter("library", "(" + collections_to_search.join(" OR ") + ")")
    }
    const results = await client.search(query);
    if (results.response.numFound >= 1) {
        return results.response.docs;
    }
    return [];
}

async function search_random_id(timestamp: string) {
    const key = `random_${timestamp}`;
    const client = solr.createClient(nconf.get('search'));
    const query = client.query().q("*:*").fl("siglum,library,book").start(0).rows(1).sort({[key]: 'desc'});
    const result: any = await client.search(query);
    if (result.response.numFound >= 1) {
        return result.response.docs[0];
    }
    return {};
}

export async function get_metadata(id: string) {
    const client = solr.createClient(nconf.get('search'));
    const query = client.query().q(`siglum:${id}`).fl("siglum,library,book").start(0).rows(1);
    const result: any = await client.search(query);
    if (result.response.numFound >= 1) {
        return result.response.docs[0];
    }
    return {};
}

export async function get_random_id() {
    const now = new Date().getTime();
    const id = await search_random_id(now.toString());
    return {id: id.siglum, book: id.book, library: id.library}
}

export class NoMawsForDocumentError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MawsTooShortError extends Error {
    constructor() {
        super("Maws are too short");
    }
}

export async function search_by_id(id: string, collections_to_search: string[], num_results: number, threshold: number,  similarity_type: 'boolean'|'jaccard'|'solr') {
    const maws = await get_maws_for_siglum(id);
    if (maws) {
        return await search(maws.split(" "), collections_to_search, num_results, threshold, similarity_type);
    } else {
        throw new NoMawsForDocumentError(`cannot get maws for document ${id}`)
    }
}

export async function search_by_codestring(codestring: string, collections_to_search: string[], num_results: number, threshold: number, similarity_type: 'boolean'|'jaccard'|'solr') {
    const maws = get_maws_for_codestrings({cs: codestring});
    if (maws['cs']) {
        return await search(maws['cs'], collections_to_search, num_results, threshold, similarity_type);
    } else {
        // `maw` binary ran successfully, but no maws were generated for this input.
        // treat this as the same as there not being enough words
        throw new MawsTooShortError();
    }
}

function set_intersection(setA: Set<string>, setB: Set<string>) {
    let _intersection = new Set();
    for (let elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem);
        }
    }
    return _intersection;
}

export type SearchResponse = {
    numQueryWords: number
    numResults: number
    results: SearchResult[]
}

type SearchResult = {
    id: string
    codestring: string
    num_matched_words: number
    num_words: number
    jaccard: number
    delta?: number
    titlepage?: string
}

/**
 * Search for
 * @param words: array of MAWs to search for
 * @param num_results: Filter by this many results
 * @param threshold
 * @param similarity_type
 * @returns {boolean|[]|*[]|*}
 */
export async function search(words: string[], collections_to_search: string[], num_results: number, threshold: number,  similarity_type: 'boolean'|'jaccard'|'solr'): Promise<SearchResponse> {
    if (words.length < 6) {
        throw new MawsTooShortError();
    }
    //console.time("search");

    // Safety check that the words are all unique:
    const search_uniq_words = new Set(words);

    const maws_results = await search_maws_solr(words, collections_to_search, num_results * 2, similarity_type);
    const maws_with_scores: SearchResult[] = maws_results.map((doc: { score: number; maws: string; siglum: string; intervals: string; book: string; library: string; titlepage?: string;}) => {
        const unique_maws = new Set(doc.maws.split(" "));
        const num_matched_words = set_intersection(unique_maws, search_uniq_words).size;
        return {
            // ID of the document
            id: doc.siglum,
            book: doc.book,
            library: doc.library,
            score: doc.score,
            codestring: doc.intervals.split(" ").join(""),
            // Number of words in common between search term and document
            num_matched_words: num_matched_words,
            // Number of unique words in the document
            num_words: unique_maws.size,
            // Jaccard similarity
            jaccard: 1 - (num_matched_words / (unique_maws.size + search_uniq_words.size - num_matched_words)),
            titlepage: doc.titlepage
        };
    });

    //console.timeEnd("pruning")
    const result = gate_scores_by_threshold(maws_with_scores, threshold, similarity_type === 'jaccard', num_results);
    //console.timeEnd("search");
    //console.log(result);
    return {
        numQueryWords: search_uniq_words.size,
        numResults: maws_results.numResults,
        results: result
     };
}

/**
 *
 * @param scores_pruned
 * @param threshold: "median" to threshold by the median score, otherwise a float value
 * @param jaccard
 * @param num_results
 * @returns {*[]|*}
 */
function gate_scores_by_threshold(scores_pruned: SearchResult[], threshold: "median" | number, jaccard: boolean, num_results: number) {
    // if threshold is set in URL, stop returning results when delta < threshold
    if (threshold) {
        const out_array = [];
        out_array[0] = scores_pruned[0];  // the identity match, or at least the best we have
        for (let p = 1; p < scores_pruned.length; p++) {
            let delta = 0;
            if (jaccard) {
                delta = jacc_delta(scores_pruned, p);
            } else {
                delta = scores_pruned[p - 1].num_matched_words - scores_pruned[p].num_matched_words;
            }
            if (threshold === "median") {
                threshold = getMedian(scores_pruned, jaccard);
            }
            if (delta >= threshold) {
                out_array[p] = scores_pruned[p];
                out_array[p].delta = delta;
            } else {
                num_results = p - 1;
                break;
            }
        }
        return out_array.slice(0, num_results);
    } else {
        // return the first num_results results
        return scores_pruned.slice(0, num_results);
    }
}

export async function search_subsequence(query_subsequence: string, num_results: number, threshold: number, interval: boolean) {
    const query_subsequences_arr = query_subsequence.split(" ");
    const result = await search_subsequences_solr(query_subsequence, [], num_results, interval);
    const response = result.map((item: SubsequenceSearchResponse) => {
        // Find the start position(s) of the search term in the results
        const positions: number[] = [];
        // console.debug(`len note subsequences: ${item.note_subsequences.split(" ").length}`)
        const note_subsequences_arr = interval ? item.intervals.split(" ") : item.notes.split(" ");
        let position = findSubarray(note_subsequences_arr, query_subsequences_arr, 0)
        while (position !== -1) {
            positions.push(position);
            position = findSubarray(note_subsequences_arr, query_subsequences_arr, position + query_subsequences_arr.length);
        }
        const pageDocument: SubsequenceResponsePage = JSON.parse(item.page_data);
        // Unwind the page/systems/notes structure to a flat array so that we can apply the above positions
        const notes: any[] = [];
        for (const system of pageDocument.systems) {
            for (const note of system.notes) {
                notes.push({note: `${note.p}${note.o}`, id: note.id, system: system.id})
            }
        }
        const responseNotes = positions.map((start) => {
            // If it's an interval search select 1 more note because we're working with gaps instead of notes
            const len = query_subsequences_arr.length + (interval ? 1 : 0);

            return {
                start_position: start,
                start_note_id: notes[start].id,
                end_position: start + len,
                end_note_id: notes[start + len - 1].id,
                length: len,
                notes: notes.slice(start, start + len)
            };
        });
        return {
            id: item.siglum,
            book: item.book,
            library: item.library,
            codestring_intervals: item.intervals.split(" "),
            codestring_notes: item.notes.split(" "),
            num_matches: responseNotes.length,
            matches: responseNotes
        };
    });
    return response;
}

export class NextIdNotFound extends Error {
    public status: number;
    constructor(message: string) {
        super();
        this.message = message;
        this.status = 404;
    }
}

export function next_id(library: string, book_id: string, page_id: string | null, direction: "prev" | "next") {
    const db_library = db[library];
    if (!db_library) {
        throw new NextIdNotFound(`Library ${library} not found`)
    }

    if (!db_library.book_ids.includes(book_id)) {
        throw new NextIdNotFound(`Book ${book_id} not found in library ${library}`)
    }
    if (page_id) {
        // If a page is set, then we want next/prev page
        const book = db_library.books[book_id];
        if (!book.page_ids.includes(page_id)) {
            throw new NextIdNotFound(`Page ${page_id} not found in book ${book_id}`)
        }
        const page_position = book.page_ids.indexOf(page_id)
        let new_position = page_position + (direction === "prev" ? -1 : 1);
        if (new_position < 0) {
            new_position = 0;
        } else if (new_position >= book.page_ids.length) {
            new_position = book.page_ids.length - 1;
        }
        const new_book_page_id = book.page_ids[new_position];
        const response = {
            library,
            book_id,
            page: book.pages[new_book_page_id]
        }
        return response;
    } else {
        // If page isn't set, we want next/prev book
        const book_position = db_library.book_ids.indexOf(book_id);
        let new_position = book_position + (direction === "prev" ? -1 : 1);
        if (new_position < 0) {
            new_position = 0;
        } else if (new_position >= db_library.books.length) {
            new_position = db_library.books.length - 1;
        }
        const new_book_id = db_library.book_ids[new_position];
        const new_book = db_library.books[new_book_id];
        // If we get a new book, we want to return the first page from that book
        const new_book_page_id = new_book.page_ids[0];
        const response = {
            library,
            book_id: new_book_id,
            page: new_book.pages[new_book_page_id]
        }
        return response;
    }
}


export async function run_image_query(image: fileUpload.UploadedFile) {
    const jaccard = true; // TODO(ra) should probably get this setting through the POST request, too...
    const num_results = 20; // TODO(ra) should probably get this setting through the POST request, too...
    const threshold = 0; // TODO(ra) should probably get this setting through the POST request, too...

    // TODO: Check if we have all of the required programs installed
    // TODO: Check each spawn call in case there was an error and don't continue

    let tmpDir;
    const appPrefix = 'emo-upload';
    try {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), appPrefix));
        await image.mv(path.join(tmpDir, image.name));

        const data = perform_omr_image(tmpDir, image.name);

        const page = parseMeiData(data);
        const intervals = pageToContourList(page)

        return search_by_codestring(intervals.join(""), [], num_results, threshold, 'jaccard');
    }
    catch (e) {
        console.error(`error when running stuff ${e}`);
        // handle error
    } finally {
        try {
            if (tmpDir) {
                fs.rmdirSync(tmpDir, { recursive: true });
            }
        }
        catch (e) {
            console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
        }
    }
}

export async function get_codestring(id: string) {
    const client = solr.createClient(nconf.get('search'));
    const query = client.query().q(`siglum:"${id}"`).fl('intervals');
    const result = await client.search(query);
    if (result.response.numFound >= 1 && result.response.docs.length) {
        const doc: any = result.response.docs[0];
        return doc.intervals?.split(" ").join("");
    }
    return undefined;
}

function jacc_delta (array: SearchResult[], n: number) {
    return array[n].jaccard - array[n - 1].jaccard;
}

function getMedian(array: SearchResult[], jaccard: boolean){
    const values = [];
    if(jaccard) {
        for(let i = 0;i < array.length;i++) {
            values.push(array[i].jaccard);
        }
    }
    else {
        for(let i = 0;i < array.length;i++) {
            values.push(array[i].num_matched_words);
        }
    }
    values.sort((a, b) => a - b);
    let median = (values[(values.length - 1) >> 1] + values[values.length >> 1]) / 2;
    //console.log("Median = " + median);
    return median;
}

