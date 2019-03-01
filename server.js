/*******************************************************************************
 * Imports 
 ******************************************************************************/
const express = require('express');
const fileUpload = require('express-fileupload');
const trie_module = require('./static/src/trie.js');
const fs = require('fs');
const cp = require('child_process');
const path_app = require('path');

/*******************************************************************************
 * Globals / Inits
 ******************************************************************************/
const MAWS_DB = './data/emo_ids_maws.txt';
const EMO_IDS = [];
const EMO_IDS_MAWS = {};
const MAWS_to_IDS = {};
const word_totals = []; // total words per id, used for normalization

let query_id;
var threshold = false; // default until supplied
let working_path;

const app = express();
const trie = new trie_module.Trie();
const ng_trie = new trie_module.Trie();

/*******************************************************************************
 * Setup
 ******************************************************************************/

load_maws(); // load the MAWS db
// load_ngram_database(9);   // Just a magic number that seems to work

const port = 8000;
app.listen(
    port,
    () => console.log('EMO app listening on port 8000!') // success callback
);

app.use(express.static('static')); // serve static files out of /static
app.use(fileUpload()); // file upload stuff

/*******************************************************************************
 * Request handlers 
 ******************************************************************************/

// Returns an array of all emo ids
app.get('/api/emo_ids', function (req, res) { res.send(EMO_IDS); });

// Handle a query
app.get('/api/query', function (req, res) {
    let num_results = 20; // Default
    threshold = false; // Default

    let jaccard = false;
    if (req.query.jaccard == 'true') { jaccard = true; } // TODO(ra): fix this in the request - POST not get...

    if(req.query.num_results) {
        num_results = parseInt(req.query.num_results);
    }

    if(req.query.threshold !== undefined) {
        const raw_t = req.query.threshold;
        if (raw_t === 'false') { threshold = false; }
        else { threshold = parseFloat(raw_t); }
    }

    let result;
    if(req.query.qstring) {
        console.log('Querying by string...');
        const query = req.query.qstring;
        result = search_trie('words', query, jaccard, num_results);
    } else if(req.query.id) {
        console.log('Querying by id...');
        result = search_trie('id', req.query.id, jaccard, num_results);

    } else if(req.query.diat_int_code) {
        console.log('q diat_int_code');
        result = search_trie_with_code(req.query.diat_int_code, jaccard, num_results);
    }

    // console.log(result)  
    res.send(result);
});

// Handle image uploads
// TODO(ra): validate supported file formats
app.post('/api/image_query', function(req, res) {
    if (!req.files) { return res.status(400).send('No files were uploaded.'); }

    // The name of the input field is used to retrieve the uploaded file
    let user_image = req.files.user_image;

    working_path = './run/';

    // Use the mv() method to save the file there
    user_image.mv(working_path + user_image.name, (err) => {
        if (err) { return res.status(500).send(err); }
        else {
            console.log("Uploaded file saved as " + working_path + user_image.name);
            const ngram_search = false; // TODO(ra): make this work!
            const result = run_image_query(user_image, ngram_search);
            res.send(result);
        }
    });
});

function run_image_query(user_image, ngram_search) {
    const jaccard = true; // TODO(ra) should probably get this setting through the POST request, too...
    const num_results = 20; // TODO(ra) should probably get this setting through the POST request, too...

    let query_data;
    let query;
    let result;
    if(!ngram_search) {
        query_data = cp.execSync('./callout_scripts/temp_image_to_maws.sh ' + user_image.name + ' ' + working_path);
        query = String(query_data); // a string of maws, preceded with an id
        result = search_trie('words', query, jaccard, num_results);
    }
    else {
        query_data = cp.execSync('./callout_scripts/do-process_for_ngrams.sh ' + user_image.name + ' ' + working_path + ' ' + '9');
        query = String(query_data);
        result = search_trie('words', query, jaccard, num_results, true);
    }

    result.unshift(path_app.basename(working_path) + '/' + user_image.name); // add path/filename to beginning of array
    return result;
}


/*******************************************************************************
 * Query functions
 ******************************************************************************/

// method can be 'id' or 'words'
// query is a string, either holding the id a id+maws line
function search_trie(method, query, jaccard, num_results, ngram) {
    if (ngram === undefined) { ngram = false; }

    if(!query) { // Need to report this back to browser/user
        console.log("No query provided!");
        return false;
    }

    let words;
    if (method === 'id') {
        if (!(query in EMO_IDS_MAWS)) { // TODO: need to report to frontend 
            console.log("ID " + query + " not found in " + MAWS_DB);
            return;
        }
        words = EMO_IDS_MAWS[query];
    } else if (method === 'words') {
        parsed_line = parse_id_maws_line(query);
        words = parsed_line.words;
    }

    let this_trie;
    if (ngram) { this_trie = ng_trie; }
    else { this_trie = trie; }

    return get_result_from_words(words, this_trie, jaccard, num_results);
}

function search_trie_with_code(str, jaccard, num_results) {
    working_path = cp.execSync('/home/mas01tc/emo_search/web-demo/set_working_path.sh') + '/';
    var qstring = cp.execSync('/home/mas01tc/emo_search/web-demo/codestring_to_maws.sh ' + str + ' ' + working_path);
    const result = search_trie('words', qstring, jaccard, num_results);
    result.unshift("code query");
    return result;
}

function get_result_from_words(words, trie, jaccard, num_results) {
    if (words.length < 6) { // TODO: Need to report to frontend
        console.log("Not enough words in query.");
        return [];
    }
    const scores = get_scores(words, trie);
    const scores_pruned = get_pruned_and_sorted_scores(scores, words.length);
    const result = gate_scores_by_threshold(scores_pruned, threshold, jaccard, num_results);
    return result;
}

function get_scores(words, trie) {
    var res = false;
    var scores = {};

    for (const word of words) {
        const ids = MAWS_to_IDS[word]
        if (!ids) { continue; }

        for(const id of ids) {
            if (!scores[id]) { scores[id] = 0; }
            scores[id]++;
        }
    }
    return scores;
}



function get_pruned_and_sorted_scores(scores, wds_in_q, jaccard) {
    var scores_pruned = [];

    // Prune
    for (var id in scores) {
        if (!scores.hasOwnProperty(id)) { continue; }
        const num = scores[id];
        if(num > 1) {
            result = {};

            const num_words = word_totals[id];

            result.id = id;
            result.num = num;
            result.num_words = num_words;

            result.jaccard = 1 - (num / (num_words + wds_in_q - num));
            scores_pruned.push(result);
        }
    }

    // Sort
    if (jaccard) {
        // Ascending, as 0 is identity match
        scores_pruned.sort((a, b) => { return a.jaccard - b.jaccard; }); 
    }
    else {
        // Descending
        scores_pruned.sort((a, b) => { return b.num - a.num; });
    }

    return scores_pruned;
}

function gate_scores_by_threshold(scores_pruned, threshold, jaccard, num_results) {
    // if threshold is set in URL, stop returning results when delta < threshold
    if (threshold) {
        const out_array = [];
        out_array[0] = scores_pruned[0];  // the identity match, or at least the best we have
        for(var p = 1; p < scores_pruned.length; p++) {
            var delta = 0;
            if (jaccard) { delta = jacc_delta(scores_pruned, p); }
            else { delta = scores_pruned[p - 1].num - scores_pruned[p].num; }
            if (threshold == "median") { threshold = 0 + getMedian(scores_pruned, jaccard); }
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


/*******************************************************************************
 * Data loading
 ******************************************************************************/

function load_maws() {
    // The 'db' is a text file, where each line is an EMO page ID,
    // followed by the MAWs for that page.

    console.log("Loading " + MAWS_DB);
    fs.readFile(MAWS_DB, 'utf8', (err, data) => {
        if (err) { throw err; }

        if (!data.length) {
            console.log("No data!");
        } else {
            parse_maws_db(data);
        }
    });
}

function parse_maws_db(data_str) {  
    const lines = data_str.split("\n");
    console.log(lines.length + " lines of MAWs to read...");

    const no_maws_ids = [];
    for (const line of lines) {
        if (line) {
            parsed_line = parse_id_maws_line(line);
            const id = parsed_line.id;
            const words = parsed_line.words;

            if (words === undefined) { // TODO(ra): how should we handle these? 
                no_maws_ids.push(id);
                continue;
            }

            EMO_IDS.push(id);           
            EMO_IDS_MAWS[id] = words; 

            word_totals[id] = words.length;
            for (const word of words) {
                trie.id_add(word, id);
                if (!MAWS_to_IDS[word]) { MAWS_to_IDS[word] = []; }
                MAWS_to_IDS[word].push(id);
            }
        }
    }

    // fs.writeFile("./run/err.log", no_maws, () => {}); // write out ids with no maws
    // console.log(no_maws);
    // console.log(EMO_IDS);
    // console.log(EMO_IDS_MAWS);
    console.log(EMO_IDS.length + " lines of MAW data loaded!");
}

/*******************************************************************************
 * Helpers
 ******************************************************************************/

function jacc_delta (array, n) {
    return array[n].jaccard - array[n - 1].jaccard;
}

function jacc_delta_log (array, n) {
    return Math.log(array[n].jaccard) - Math.log(array[n - 1].jaccard);
}

function console_sample(array, num, str) {
    console.log("Sampling array " + str + " - " + num + " entries");
    for(var i = 0;i < num;i++) {
        console.log(i + ". " + array[i].id);
    }
}

function getMedian(array, jaccard){
    var values = [];
    if(jaccard == "true") {
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
    console.log("Median = " + median);
    return median;
}

function parse_id_maws_line(line) {
    parsed_line = {};

    let [id, maws_str] = line.split(/ (.+)/); // splits on first match of whitespace

    if (id.charAt(0) === '>') { id = id.substring(1); } // remove leading > if it's there
    parsed_line.id = id;

    if (maws_str === undefined) { return parsed_line; }

    const words = maws_str.split(/[ ,]+/).filter(Boolean); // splits rest into words by whitespace
    parsed_line.words = words;
    return parsed_line;
}

/*******************************************************************************
 * ngram stuff, unused but leaving here for now... 
 ******************************************************************************/
// var ng_lines = [];
//
//
// function load_ngram_database(n) {
//  var ng_len = n;
//      if((ng_len>2)&&(ng_len<16)) {
//      db_name ="./data/emo_data/databases/ngrams/emo_"+ng_len+"grams.txt";
//      console.log("Trying to load "+db_name);
//      get_and_load_ngram_database(db_name);
//  }
//  else alert("Loading ngram database failed!");
//}
// function get_and_load_ngram_database(db_name) {
//      console.log("Actually loading "+db_name);
//  fs.readFile(db_name,'utf8',(err,data) => {
//      if (err) {
//          throw err;
//      }
//      if(!data.length) console.log("No data!!");
//      else {
//          console.log("Loading "+data.length+" of ngram data")
//          load_ngram_data(data);
//      }
//  })
// }

// function load_ngram_data(data) {
//  ng_lines = data.split("\n");
//     console.log(ng_lines.length+" lines of ngrams to read");
//  for(i in ng_lines) {
//      bits = ng_lines[i].split(/[ ,]+/).filter(Boolean);
//      if (typeof bits[0] !== 'undefined') {
//          var id = "";
//          // chop initial ">" from fasta format
//          if(bits[0].charAt(0)==">") id = bits[0].substring(1);
//          else id = bits[0];
//          word_totals[id] = bits.length - 1;
//          for(j=1;j<bits.length;j++) {
//              ng_trie.id_add(bits[j],id);
//          }
//      }
//      else {
//          console.log("End of ngram data")
//      }
//  }
//  console.log(i+" lines of ngram data loaded!");
//  console.log("Ngrams initialised");
// }
