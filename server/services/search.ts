import fs from 'fs';
import os from 'os';
import cp from 'child_process';
import solr from 'solr-client';
import nconf from 'nconf';
import {get_maws_for_codestrings} from "../../lib/maw.js";
import * as path from "path";
import fileUpload from "express-fileupload";
import {pageToContourList, parseMei} from "../../lib/mei.js";

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
    }
}

async function search_maws_solr(maws: string[], collections_to_search: string[], num_results: number): Promise<any> {
    maws = maws.map(quote);
    collections_to_search = collections_to_search.map(quote)
    const client = solr.createClient(nconf.get('search'));
    let query = client.query().defType('dismax').q(maws.join(" ")).qf({maws:1}).mm(1).rows(num_results);
    if (collections_to_search.length) {
        query = query.matchFilter("library", "(" + collections_to_search.join(" OR ") + ")")
    }
    const result = await client.search(query);
    if (result.response.numFound >= 1) {
        return result.response.docs;
    }
    return []
}

async function search_ngrams_solr(ngrams: string, collections_to_search: string[], num_results: number, interval: boolean): Promise<any> {
    collections_to_search = collections_to_search.map(quote)
    const client = solr.createClient(nconf.get('search'));
    const qob = interval ? {intervals: quote(ngrams)} : {notes: quote(ngrams)}
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

export async function get_random_id() {
    const now = new Date().getTime();
    const id = await search_random_id(now.toString());
    return {id: id.siglum, book: id.book, library: id.library}
}

export async function search_by_id(id: string, collections_to_search: string[], jaccard: boolean, num_results: number, threshold: number) {
    const maws = await get_maws_for_siglum(id);
    return await search(maws.split(" "), collections_to_search, jaccard, num_results, threshold);
}

export async function search_by_codestring(codestring: string, collections_to_search: string[], jaccard: boolean, num_results: number, threshold: number) {
    const maws = get_maws_for_codestrings({cs: codestring});
    if (maws) {
        return await search(maws['cs'], collections_to_search, jaccard, num_results, threshold);
    } else {
        return []
    }
}

export async function search_by_ngram(ngram: string, num_results: number, threshold: number, interval: boolean) {
    const ngrams = await search_ngrams_solr(ngram, [], num_results, interval);
    return ngrams;
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

type SearchResult = {
    id: string
    codestring: string
    num_matched_words: number
    num_words: number
    jaccard: number
    delta?: number
}

/**
 * Search for
 * @param words: array of MAWs to search for
 * @param jaccard: True if sort by jaccard similarity, otherwise sort by number of matching tokens
 * @param num_results: Filter by this many results
 * @param threshold
 * @returns {boolean|[]|*[]|*}
 */
async function search(words: string[], collections_to_search: string[], jaccard: boolean, num_results: number, threshold: number): Promise<SearchResult[]> {
    if (words.length < 6) { // TODO: Need to report to frontend
        // console.log("Not enough words in query.");
        return [];
    }
    //console.time("search");

    // Safety check that the words are all unique:
    const search_uniq_words = new Set(words);

    const maws_results = await search_maws_solr(words, collections_to_search, num_results * 2);
    const maws_with_scores: SearchResult[] = maws_results.map((doc: { maws: string; siglum: string; intervals: string; book: string; library: string;}) => {
        const unique_maws = new Set(doc.maws.split(" "));
        const num_matched_words = set_intersection(unique_maws, search_uniq_words).size;
        return {
            // ID of the document
            id: doc.siglum,
            book: doc.book,
            library: doc.library,
            codestring: doc.intervals.split(" ").join(""),
            // Number of words in common between search term and document
            num_matched_words: num_matched_words,
            // Number of unique words in the document
            num_words: unique_maws.size,
            // Jaccard similarity
            jaccard: 1 - (num_matched_words / (unique_maws.size + search_uniq_words.size - num_matched_words))
        };
    });

    if (jaccard) {
        // Ascending, as 0 is identity match
        maws_with_scores.sort((a: SearchResult, b: SearchResult) => {
            return a.jaccard - b.jaccard;
        });
    } else {
        // Descending
        maws_with_scores.sort((a: SearchResult, b: SearchResult) => {
            return b.num_matched_words - a.num_matched_words
        });
    }

    //console.timeEnd("pruning")
    const result = gate_scores_by_threshold(maws_with_scores, threshold, jaccard, num_results);
    //console.timeEnd("search");
    //console.log(result);
    return result;
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
        await image.mv(path.join(tmpDir, image.name))

        const status = cp.spawnSync(
            "convert",
            [image.name, "-alpha", "off", "page.tiff"],
            {cwd: tmpDir})
        if (status.status !== 0) {
            console.error(status.stdout)
            console.error(status.stderr)
        }

        const aruspixStatus = cp.spawnSync(
            "aruspix-cmdline",
            ["-m", "/storage/ftempo/aruspix_models", "page.tiff"],
            {cwd: tmpDir})

        const zipStatus = cp.spawnSync(
            "unzip",
            ["-q", "page.axz", "page.mei"],
            {cwd: tmpDir})

        const page = parseMei(path.join(tmpDir, "page.mei"));
        const intervals = pageToContourList(page)

        return search_by_codestring(intervals.join(""), [], jaccard, num_results, threshold);
    }
    catch (e) {
        console.error(`error when running stuff ${e}`);
        // handle error
    } finally {
        try {
            if (tmpDir) {
                //fs.rmdirSync(tmpDir, { recursive: true });
            }
        }
        catch (e) {
            console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
        }
    }
}

type BookId = {
    RISM?: string
    book?: string
    page?: string
}

// Get library siglum, book siglum and page_code from id
// The book siglum is the section of the id following the RISM siglum
// NB The style of underscore-separation differs between collections
export function parse_id(id: string): BookId {
//console.log("ID: "+id)
    let parsed_id: BookId = {};
    let segment = id.split("_");
    // The library RISM siglum is always the prefix to the id,
    // followed by the first underscore in the id.
    parsed_id.RISM = segment[0];
    switch (parsed_id.RISM) {
        case "D-Mbs":
        case "PL-Wn":
            parsed_id.book = segment[1];
            parsed_id.page = segment[2];
            break;
        case "F-Pn":
            // parsed_id.book = segment[1];
            // parsed_id.page = segment[2]+"_"+segment[3]
            break;
        case "GB-Lbl":
            if (segment.length === 4) {
                parsed_id.book = segment[1];
                parsed_id.page = segment[2] + "_" + segment[3];
            }
            else {
                parsed_id.book = segment[1] + "_" + segment[2];
                parsed_id.page = segment[3] + "_" + segment[4];
            }
            break;
    }
    return parsed_id;
}

export async function get_codestring(id: string) {
    const client = solr.createClient(nconf.get('search'));
    const query = client.query().q(`siglum:"${id}"`).fl('codestring');
    const result = await client.search(query);
    if (result.response.numFound >= 1) {
        const doc: any = result.response.docs[0];
        return doc.codestring;
    }
    return "";
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

