
import cp from 'child_process';
import solr from 'solr-client';
import {SOLR_HOST} from "../server.js";
import once from "once";

function quote(str) {
    return `"${str}"`;
}

function get_maws_for_siglum(siglum) {
    return new Promise((resolve, reject)=> {
        const client = solr.createClient({host: SOLR_HOST, port: "8983", "core": "ftempo"});
        const query = client.createQuery().q('siglum:' + quote(siglum)).fl('maws');
        client.search(query, function (err, obj) {
            if (err) {
                reject(obj);
            } else {
                console.log(obj);
                if (obj.response.numFound >= 1) {
                    const doc = obj.response.docs[0];
                    resolve(doc.maws);
                }
                resolve([]);
            }
        });
    });
}

async function get_maws_for_codestring(codestring) {
    let maws_output;
    const inputstr = `>input:\n${codestring}\n`;
    const maws = cp.spawn("/usr/local/bin/maw", ["-a", "PROT", "-i", "-", "-o", "-", "-k", "4", "-K", "8"]);
    maws.stdout.on('data', (data) => {
        console.log(typeof data);
        maws_output = data.toString().split("\n");
        // Return any empty lines and the first sentinel line that starts with >
        maws_output = maws_output.filter(val => val && !val.startsWith(">"));
    });
    maws.stdin.write(inputstr);
    maws.stdin.end();

    await once(maws, 'close');
    return maws_output;
}

async function search_maws_solr(maws) {
    maws = maws.map(quote);
    return new Promise((resolve, reject)=> {
        const client = solr.createClient({host: SOLR_HOST, port: "8983", "core": "ftempo"});
        const query = client.createQuery().defType('dismax').q(maws.join(" ")).qf({maws:1}).mm(1);
        client.search(query, function (err, obj) {
            if (err) {
                reject(obj);
            } else {
                if (obj.response.numFound >= 1) {
                    resolve(obj.response.docs);
                }
                resolve([]);
            }
        });
    });
}

async function search_random_id(timestamp) {
    return new Promise((resolve, reject) => {
        const client = solr.createClient({host: SOLR_HOST, port: "8983", "core": "ftempo"});
        const query = client.createQuery().q("*:*").fl("siglum").start(0).rows(1).sort(`random_${timestamp} desc`);
        client.search(query, function (err, obj) {
            if (err) {
                reject(obj);
            } else {
                if (obj.response.numFound >= 1) {
                    resolve(obj.response.docs[0].siglum);
                }
                resolve("");
            }
        });
    });
}

export async function get_random_id() {
    const now = new Date().getTime();
    return await search_random_id(now);
}

export async function search_by_id(id, jaccard, num_results, threshold) {
    const maws = await get_maws_for_siglum(id);
    return await search(maws, jaccard, num_results, threshold);
}

export async function search_by_codestring(codestring, jaccard, num_results, threshold) {
    const maws = await get_maws_for_codestring(codestring);
    console.log(`maws is ${maws}`);
    return await search(maws, jaccard, num_results, threshold);
}

function set_intersection(setA, setB) {
    let _intersection = new Set();
    for (let elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem);
        }
    }
    return _intersection;
}

/**
 * Search for
 * @param words: array of MAWs to search for
 * @param jaccard: True if sort by jaccard similarity, otherwise sort by number of matching tokens
 * @param num_results: Filter by this many results
 * @param threshold
 * @returns {boolean|[]|*[]|*}
 */
async function search(words, jaccard, num_results, threshold) {
    if (words.length < 6) { // TODO: Need to report to frontend
        // console.log("Not enough words in query.");
        return [];
    }
    //console.time("search");

    // Safety check that the words are all unique:
    const search_uniq_words = new Set(words);

    const maws_results = await search_maws_solr(words);
    const maws_with_scores = maws_results.map(doc => {
        const unique_maws = new Set(doc.maws);
        const num_matched_words = set_intersection(unique_maws, search_uniq_words).size;
        return {
            // ID of the document
            id: doc.siglum,
            codestring: doc.codestring,
            // Number of words in common between search term and document
            num: num_matched_words,
            // Number of unique words in the document
            num_words: unique_maws.size,
            // Jaccard similarity
            jaccard: 1 - (num_matched_words / (unique_maws.size + search_uniq_words.size - num_matched_words))
        };
    });

    if (jaccard) {
        // Ascending, as 0 is identity match
        maws_with_scores.sort((a, b) => {
            return a.jaccard - b.jaccard;
        });
    } else {
        // Descending
        maws_with_scores.sort((a, b) => {
            return b.num - a.num;
        });
    }

    //console.timeEnd("pruning")
    const result = gate_scores_by_threshold(maws_with_scores, threshold, jaccard, num_results);
    //console.timeEnd("search");
    console.log(result);
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
function gate_scores_by_threshold(scores_pruned, threshold, jaccard, num_results) {
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
        return out_array;
    } else {
        // return the first num_results results
        return scores_pruned.slice(0, num_results);
    }
}


// ** TODO NB: this only supports MAW-based searches at present
export function run_image_query(user_id, user_image_filename, the_working_path, ngram_search) {
    const jaccard = true; // TODO(ra) should probably get this setting through the POST request, too...
    const num_results = 20; // TODO(ra) should probably get this setting through the POST request, too...
    const threshold = false; // TODO(ra) should probably get this setting through the POST request, too...

    let query_data;
    let query;
    let result;
    if(!ngram_search) {
        try {
            query_data = cp.execSync('./shell_scripts/image_to_maws.sh ' // script takes 2 command line params
                + user_image_filename + ' ' + the_working_path);
            query = String(query_data); // a string of maws, preceded with an id
        } catch (err) {
            // something broke in the shell script...
            return;
        }
        // console.log("query is "+query)
        result = search('words', query, jaccard, num_results, threshold);
    }
    else {
        try {
            query_data = cp.execSync('./shell_scripts/image_to_ngrams.sh ' + user_image_filename + ' ' + the_working_path + ' ' + '9');
            query = String(query_data);
        } catch (err) { return; } // something broke in the shell script...
        if (query) {
            result = search('words', query, jaccard, num_results, threshold);
        }
    }

    return result;
}

// Get library siglum, book siglum and page_code from id
// The book siglum is the section of the id following the RISM siglum
// NB The style of underscore-separation differs between collections
export function parse_id(id) {
//console.log("ID: "+id)
    let parsed_id = {};
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

export async function get_codestring(id) {
    return new Promise((resolve, reject)=> {
        const client = solr.createClient({host: SOLR_HOST, port: "8983", "core": "ftempo"});
        const query = client.createQuery().q('siglum:"' + id + '"').fl('codestring');
        client.search(query, function (err, obj) {
            if (err) {
                reject(obj);
            } else {
                console.log(obj);
                if (obj.response.numFound >= 1) {
                    const doc = obj.response.docs[0];
                    resolve(doc.codestring);
                }
                resolve("");
            }
        });
    });
}



function jacc_delta (array, n) {
    return array[n].jaccard - array[n - 1].jaccard;
}

function getMedian(array, jaccard){
    const values = [];
    if(jaccard === "true") {
        for(let i = 0;i < array.length;i++) {
            values.push(array[i].jaccard);
        }
    }
    else {
        for(let i = 0;i < array.length;i++) {
            values.push(array[i].num);
        }
    }
    values.sort((a, b) => a - b);
    let median = (values[(values.length - 1) >> 1] + values[values.length >> 1]) / 2;
    //console.log("Median = " + median);
    return median;
}

