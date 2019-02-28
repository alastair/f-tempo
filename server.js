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

let query_id;
var num_results = 20; // default num of results to display
var threshold = false; // default until supplied
var search_str = "";

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
    num_results = 20; // Default
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
        search_str = req.query.qstring;
        result = search_trie_with_string(search_str, jaccard);
    } else if(req.query.id) {
        console.log('Querying by id...');
        result = search_trie(req.query.id, jaccard);

    } else if(req.query.diat_int_code) {
        console.log('q diat_int_code');
        result = search_trie_with_code(req.query.diat_int_code, jaccard);
    }

    // console.log(result)  
    res.send(result);
});

// Handle image uploads
// TODO(ra): ensure correct file format (I think we only handle jpg right now?)
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
    let result;
    let qstring;
    if(!ngram_search) {
        qstring = cp.execSync('./external_scripts/do-absolutely_everything.sh '+ user_image.name +' '+ working_path);
        result = search_trie_with_string(qstring,jaccard);
    }
    else {
        qstring = cp.execSync('./external_scripts/do-process_for_ngrams.sh '+ user_image.name +' '+ working_path + ' '+'9');
        result = search_ngram_trie_with_string(qstring,jaccard);
    }

    result.unshift(path_app.basename(working_path)+'/'+user_image.name);
    console.log(result);
    return result;
}


/*******************************************************************************
 * Query functions
 ******************************************************************************/
function search_trie(id, jaccard) {
    if (!(id in EMO_IDS_MAWS)) { // TODO: need to report to frontend 
        console.log("ID " + id + " not found in " + MAWS_DB);
        return;
    }

    const words = EMO_IDS_MAWS[id];

    if (words.length < 6) { // TODO: Need to report to frontend
        console.log("Not enough words in query " + id);
        return;
    }

    const scores = get_scores(words, trie);
    const scores_pruned = get_pruned_and_sorted_scores(scores, words.length);
    const result = gate_scores_by_threshold(scores_pruned, threshold, jaccard);
    return result;
}



// Code to execute a MAW query in str
function search_trie_with_string(str, jaccard) {
    var x = str + '';
    if(!x) {
        // Need to report this back to browser/user
        console.log("No string provided!");
        return false;
    }

    const queryArray = x.split(/\s/);
    const query_id = queryArray[0];

    const wds_in_q = queryArray.length-1;
    console.log(wds_in_q+' words in query');

    if(wds_in_q < 6) {
        // Need to report this back to browser/user
        console.log("Not enough data in query "+query_id+". Try again!");
        return;
    }

    var words = [];
    for(let i = 1; i < queryArray.length; i++) {
        if(queryArray[i].length) {
            words.push(queryArray[i]);
        }
    }

    const scores = get_scores(words, trie);
    const scores_pruned = get_pruned_and_sorted_scores(scores, words.length, jaccard);
    const result = gate_scores_by_threshold(scores_pruned, threshold, jaccard);
    return result;
}

function search_ngram_trie_with_string(str, jaccard) {
    var x = str + '';
    if(!x) {
    // Need to report this back to browser/user
        console.log("No string provided!");
        return false;
    }
    else {
        var queryArray = x.split(/\s/);
        var id = query_id = queryArray[0];
        if(id.substring(0,1)==">") query_id = query_id.substring(1);
        const wds_in_q = queryArray.length-1;
        console.log(wds_in_q+' words in query');
        if(wds_in_q < 6) {
            // Need to report this back to browser/user
            console.log("Not enough data in query "+query_id+". Try again!");
            return;
        }
    }
    var words = [];
    for(let i=1;i<queryArray.length;i++) {
        if(queryArray[i].length) {
            words.push(queryArray[i]);
        }
    }

    const scores = get_scores(words, ng_trie);
    const scores_pruned = get_pruned_and_sorted_scores(scores, wds_in_q, jaccard);
    const result = gate_scores_by_threshold(scores_pruned, threshold, jaccard);
    return result;

}



function search_trie_with_code(str, jaccard) {
    working_path = cp.execSync('/home/mas01tc/emo_search/web-demo/set_working_path.sh') + '/';
    var qstring = cp.execSync('/home/mas01tc/emo_search/web-demo/codestring_to_maws.sh '+ str +' '+ working_path);
    const result = search_trie_with_string(qstring,jaccard);
    result.unshift("code query");
    return result;
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
        if (!data.length) { console.log("No data!"); }
        else {
            parse_maws_db(data);
        }
    });
}

// array containing objects holding number of MAWs/ngrams for each id in database
// for use in normalisation elsewhere
var word_totals = [];

function parse_maws_db(data_str) {  
    const lines = data_str.split("\n");
    console.log(lines.length + " lines of MAWs to read...");

    const no_maws_ids = [];
    for (const line of lines) {
        if (line) {
            const [id, maws_str] = line.split(/ (.+)/); // splits on first match of ' '

            if (maws_str === undefined) {
                // TODO(ra): how should we handle these? 
                no_maws_ids.push(id);
                continue;
            }

            const words = maws_str.split(/[ ,]+/).filter(Boolean); // splits rest into chunks

            EMO_IDS.push(id);           
            EMO_IDS_MAWS[id] = words; 
            word_totals[id] = words.length;
            for (const word of words) {
                trie.id_add(word, id);
            }
        }
    }

    // fs.writeFile("./run/err.log", no_maws, () => {});
    // console.log(no_maws);
    // console.log(EMO_IDS);
    // console.log(EMO_IDS_MAWS);
    console.log(EMO_IDS.length + " lines of MAW data loaded!");
}




/*******************************************************************************
 * Helpers
 ******************************************************************************/

function jacc_delta (array,n) {
    return array[n].jaccard - array[n-1].jaccard;
}

function jacc_delta_log (array,n) {
    return Math.log(array[n].jaccard) - Math.log(array[n-1].jaccard);
}

function console_sample(array,num,str) {
    console.log("Sampling array "+str+" - "+num+" entries");
    for(var i=0;i<num;i++) {
        console.log(i + ". " + array[i].id);
    }
}

function getMedian(array,jaccard){
    var values = [];
    if(jaccard=="true") {
        for(let i=0;i<array.length;i++) {
            values.push(array[i].jaccard);
        }
    }
    else { 
        for(let i=0;i<array.length;i++) {
            values.push(array[i].num);
        }
    }
    values.sort((a, b) => a - b);
    let median = (values[(values.length - 1) >> 1] + values[values.length >> 1]) / 2;
    console.log("Median = "+median);
    return median;
}

function get_scores(words, trie) {
    var res = false;
    var scores = [];
    for(const word of words) {
        res = trie.getIDs(word);
        if(res != false) {
            for(var item of res.values()) {
                if (!scores[item])  {
                    scores[item] = {};
                    scores[item].id = item;
                    scores[item].num = 0;
                }
                scores[item].num++;
            }
        }
    }
    return scores;
}

function get_pruned_and_sorted_scores(scores, wds_in_q, jaccard) {
    var result_num = 0;
    var scores_pruned = [];

    // Prune
    for(var g in scores) {
        if(scores[g].num > 1) {
            scores_pruned[result_num] = {};
            scores_pruned[result_num].id=scores[g].id;
            scores_pruned[result_num].num=scores[g].num;
            scores_pruned[result_num].num_words= word_totals[scores_pruned[result_num].id];
            scores_pruned[result_num].jaccard = 1-(scores[g].num/(scores_pruned[result_num].num_words+wds_in_q-scores_pruned[result_num].num));
            result_num++;
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



function gate_scores_by_threshold(scores_pruned, threshold, jaccard) { 
    // if threshold is set in URL, stop returning results when delta < threshold
    if (threshold) {
        const out_array = [];
        out_array[0] = scores_pruned[0];  // the identity match, or at least the best we have
        for(var p = 1; p<scores_pruned.length; p++) {
            var delta = 0;
            if (jaccard) { delta = jacc_delta(scores_pruned, p); }
            else { delta = scores_pruned[p-1].num - scores_pruned[p].num; }
            if (threshold=="median") { threshold = 0 + getMedian(scores_pruned,jaccard); }
            if (delta >= threshold) {
                out_array[p] = scores_pruned[p];
                out_array[p].delta = delta;
            } else {
                num_results = p-1;
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
