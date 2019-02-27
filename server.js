/*******************************************************************************
 * Imports 
 ******************************************************************************/
const express = require('express');
const fileUpload = require('express-fileupload');
const trie_module = require('./static/src/trie.js');
const fs = require('fs');
const cp = require('child_process');

/*******************************************************************************
 * Globals / Inits
 ******************************************************************************/

const MAWS_DB = './data/emo_ids_maws.txt';
const EMO_IDS = []

var lines = [];
var ng_lines = [];
let query_id;
var jaccard = "true"; // default
var num_results = 20; // default num of results to display
var threshold = false; // default until supplied
var search_str = "";
var out_array = [];

let working_path;

const app = express();
const trie = new trie_module.Trie();
const ng_trie = new trie_module.Trie();

/*******************************************************************************
 * Server config
 ******************************************************************************/

const port = 8000;
app.listen(
    port,
    () => console.log('EMO app listening on port 8000!') // success callback
)

app.use(express.static('static')) // serve static files out of /static
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
	jaccard = req.query.jaccard;

	if(req.query.num_results) {
		num_results = req.query.num_results;
	}

	if(req.query.threshold) {
		threshold = req.query.threshold;
	}

	if(req.query.qstring) {
		search_str = req.query.qstring;
		console.log(search_str)
		trieSearchWithString(search_str,jaccard);
	} else if(req.query.id) {
        trieSearch(req.query.id,jaccard);
    } else if(req.query.diat_int_code) {
        trieSearchWithCode(req.query.diat_int_code,jaccard);
    }

    //console.log(out_array)	
	res.send(out_array);
});



// Code for uploading a photo/image (.jpg), processing/extracting query and searching
app.post('/api/image_query', function(req, res) {
    if (!req.files) { return res.status(400).send('No files were uploaded.'); }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let user_image = req.files.user_image;

    // Call set_working_path.sh to get a new directory
    working_path = cp.execSync('/home/mas01tc/emo_search/web-demo/set_working_path.sh') + '/';
    // Use the mv() method to save the file there
    user_image.mv(working_path+user_image.name, function(err) {
        if (err)
            return res.status(500).send(err);
        console.log("Uploaded file saved as " + working_path+user_image.name);

        if(!ngram_search) {
            var qstring = cp.execSync('/home/mas01tc/emo_search/web-demo/do-absolutely_everything.sh '+ user_image.name +' '+ working_path);
            out_array = trieSearchWithString(qstring,jaccard);
        }
        else {
            var qstring = cp.execSync('/home/mas01tc/emo_search/web-demo/do-process_for_ngrams.sh '+ user_image.name +' '+ working_path + ' '+'9');
            out_array = trieNgramSearchWithString(qstring,jaccard);
        }
        var path = require('path');
        out_array.unshift(path.basename(working_path)+'/'+user_image.name);
        console.log(out_array)
        res.send(out_array);
    });
});

function searchTrieWithCode(str,jaccard) {
  // Call set_working_path.sh to get a new directory
	working_path = cp.execSync('/home/mas01tc/emo_search/web-demo/set_working_path.sh') + '/';
	var qstring = cp.execSync('/home/mas01tc/emo_search/web-demo/codestring_to_maws.sh '+ str +' '+ working_path);
	out_array = trieSearchWithString(qstring,jaccard);
	out_array.unshift("code query");
//	res.send(out_array);
	return out_array;
}

function trieSearchWithString(str,jaccard) {
	searchTrieWithString(str,jaccard);
	return out_array;
}

function trieNgramSearchWithString(str,jaccard) {
	searchNgramTrieWithString(str,jaccard);
	return out_array;
}

function trieSearchWithCode(str,jaccard) {
	searchTrieWithCode(str,jaccard);
	return out_array;
}

function trieSearch(id,jaccard) {
	searchTrie(id,jaccard);
}


// Currently not in use...
// function load_ngram_database(n) {
//  var ng_len = n;
//      if((ng_len>2)&&(ng_len<16)) {
//		db_name ="./data/emo_data/databases/ngrams/emo_"+ng_len+"grams.txt";
//		console.log("Trying to load "+db_name);
//		get_and_load_ngram_database(db_name);
//	}
//	else alert("Loading ngram database failed!");
//}
// function get_and_load_ngram_database(db_name) {
// 		console.log("Actually loading "+db_name);
// 	fs.readFile(db_name,'utf8',(err,data) => {
// 		if (err) {
// 			throw err;
// 		}
// 		if(!data.length) console.log("No data!!");
// 		else {
// 			console.log("Loading "+data.length+" of ngram data")
// 			load_ngram_data(data);
// 		}
// 	})
// }

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
	lines = data_str.split("\n");
    console.log(lines.length + " lines of MAWs to read...");

	for (line of lines) {
        if (line) {
            chunks = line.split(/[ ,]+/).filter(Boolean);
            const id = chunks[0];
            EMO_IDS.push(id);
            word_totals[id] = chunks.length - 1;
            for (chunk of chunks) {
                trie.id_add(chunk, id);	
            }
        }
    }
	console.log(EMO_IDS.length + " lines of MAW data loaded!");
}


function load_ngram_data(data) {
	ng_lines = data.split("\n");
		console.log(ng_lines.length+" lines of ngrams to read");
	for(i in ng_lines) {
		bits = ng_lines[i].split(/[ ,]+/).filter(Boolean);
		if (typeof bits[0] !== 'undefined') {
			var id = "";
			// chop initial ">" from fasta format
			if(bits[0].charAt(0)==">") id = bits[0].substring(1); 
			else id = bits[0]; 
			word_totals[id] = bits.length - 1;
			for(j=1;j<bits.length;j++) {
				ng_trie.id_add(bits[j],id);	
			}
		}
		else {
			console.log("End of ngram data")
		}
	}
	console.log(i+" lines of ngram data loaded!");
	console.log("Ngrams initialised");
}

var last_query_id = "";

function jacc_delta (array,n) {
	return array[n].jaccard - array[n-1].jaccard;
}
function jacc_delta_log (array,n) {
	return Math.log(array[n].jaccard) - Math.log(array[n-1].jaccard);
}

function console_sample(array,num,str) {
	console.log("Sampling array "+str+" - "+num+" entries")
	for(var i=0;i<num;i++) {
		console.log(i + ". " + array[i].id);
	}
}

function getMedian(array,jaccard){
	var values = [];
	if(jaccard=="true") {
		for(i=0;i<array.length;i++) {
			values.push(array[i].jaccard);
		}
	}
	else { 
		for(i=0;i<array.length;i++) {
			values.push(array[i].num);
		}
	}
	values.sort((a, b) => a - b);
	let median = (values[(values.length - 1) >> 1] + values[values.length >> 1]) / 2
console.log("Median = "+median);
	return median;
}

// Code to execute a MAW query in str
function searchTrieWithString(str,jaccard) {
	out_array.length = 0;
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
        wds_in_q = queryArray.length-1
console.log(wds_in_q+' words in query')
        if(wds_in_q < 6) {
    // Need to report this back to browser/user
            console.log("Not enough data in query "+query_id+". Try again!");
            return;
        }
    }
    var words = [];
    for(i=1,qa_length=queryArray.length;i<qa_length;i++) {
        if(queryArray[i].length) {
            words.push(queryArray[i]);
        }
    }
    var res = false;
    var score = [];
    for(w in words) {
        res = trie.getIDs(words[w]);
        if(res != false) {
            for(var item of res.values()) {
                if (!score[item])  {
                    score[item] = {};
                    score[item].id = item;
                    score[item].num = 0;
                }
                score[item].num++;
            }
        }
    }
	
	var result_num = 0;
	var scores_pruned = [];
	for(var g in score) {
		if(score[g].num > 1) {
			scores_pruned[result_num] = {};
			scores_pruned[result_num].id=score[g].id;
			scores_pruned[result_num].num=score[g].num;
			scores_pruned[result_num].num_words= word_totals[scores_pruned[result_num].id];
			scores_pruned[result_num].jaccard = 1-(score[g].num/(scores_pruned[result_num].num_words+wds_in_q-scores_pruned[result_num].num));
			result_num++;
		}
	}	
// Sort scores_pruned appropriately
//console.log("jaccard: "+jaccard);
	if(jaccard=="true") {
//console_sample(scores_pruned,10,"scores_pruned UNSORTED");
	scores_pruned.sort(function(a, b){return a.jaccard-b.jaccard}); // Ascending, as 0 is identity match
	}
	else scores_pruned.sort(function(a, b){return b.num-a.num}); // Descending
//console_sample(scores_pruned,10,"scores_pruned SORTED");

	// if threshold is set in URL, stop returning results when delta < threshold
	if(threshold) {
		out_array[0]=scores_pruned[0];  // the identity match, or at least the best we have
		for(var p=1;p<scores_pruned.length; p++) {
			var delta = 0;
			if(jaccard=="true") delta = jacc_delta(scores_pruned, p);
			else delta = scores_pruned[p-1].num - scores_pruned[p].num;
			if(threshold=="median") threshold = 0 + getMedian(scores_pruned,jaccard);
			if( delta >= threshold) {
				out_array[p] = scores_pruned[p];
				out_array[p].delta = delta;
			}
			else {
				num_results = p-1;
				break;
			}
		}
	}
	else
	//  return the first num_results results (as JSON?) to the client
		out_array = scores_pruned.slice(0,num_results);
}

// Code to execute an ngram query in str
function searchNgramTrieWithString(str,jaccard) {
	out_array.length = 0;
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
        wds_in_q = queryArray.length-1
console.log(wds_in_q+' words in query')
        if(wds_in_q < 6) {
    // Need to report this back to browser/user
            console.log("Not enough data in query "+query_id+". Try again!");
            return;
        }
    }
    var words = [];
    for(i=1,qa_length=queryArray.length;i<qa_length;i++) {
        if(queryArray[i].length) {
            words.push(queryArray[i]);
        }
    }
    var res = false;
    var score = [];
    for(w in words) {
        res = ng_trie.getIDs(words[w]);
        if(res != false) {
            for(var item of res.values()) {
                if (!score[item])  {
                    score[item] = {};
                    score[item].id = item;
                    score[item].num = 0;
                }
                score[item].num++;
            }
        }
    }
	var result_num = 0;
	var scores_pruned = [];
	for(var g in score) {
		if(score[g].num > 1) {
			scores_pruned[result_num] = {};
			scores_pruned[result_num].id=score[g].id;
			scores_pruned[result_num].num=score[g].num;
			scores_pruned[result_num].num_words= word_totals[scores_pruned[result_num].id];
			scores_pruned[result_num].jaccard = 1-(score[g].num/(scores_pruned[result_num].num_words+wds_in_q-scores_pruned[result_num].num));
			result_num++;
		}
	}	
// Sort scores_pruned appropriately
	if(jaccard=="true") {
//console_sample(scores_pruned,10,"scores_pruned UNSORTED");
	scores_pruned.sort(function(a, b){return a.jaccard-b.jaccard}); // Ascending, as 0 is identity match
	}
	else scores_pruned.sort(function(a, b){return b.num-a.num}); // Descending
//console_sample(scores_pruned,10,"scores_pruned SORTED");

	// if threshold is set in URL, stop returning results when delta < threshold
	if(threshold) {
		out_array[0]=scores_pruned[0];  // the identity match, or at least the best we have
		for(var p=1;p<scores_pruned.length; p++) {
			var delta = 0;
			if(jaccard=="true") delta = jacc_delta(scores_pruned, p);
			else delta = scores_pruned[p-1].num - scores_pruned[p].num;
			if(threshold=="median") threshold = 0 + getMedian(scores_pruned,jaccard);
			if( delta >= threshold) {
				out_array[p] = scores_pruned[p];
				out_array[p].delta = delta;
			}
			else {
				num_results = p-1;
				break;
			}
		}
	}
	else
	//  return the first num_results results (as JSON?) to the client
		out_array = scores_pruned.slice(0,num_results);
}

function searchTrie(qid,jaccard) {
	out_array.length = 0;	
    var x = "";
    x = get_query_from_id(qid);
    if(!x) {
    // Need to report this back to browser/user
        console.log("ID " + qid + " not found in " + MAWS_DB);
        return false;
    }
    else {					
        var queryArray = x.split(/\s/);
        var id = query_id = queryArray[0];
        if(id.substring(0,1)==">") query_id = query_id.substring(1);
        wds_in_q = queryArray.length-1
        if(wds_in_q < 6) {		
    // Need to report this back to browser/user
            console.log("Not enough data in query "+query_id+". Try again!");
            return;
        }
    }
    var words = [];
    for(i=1,qa_length=queryArray.length;i<qa_length;i++) {
        if(queryArray[i].length) {
            words.push(queryArray[i]);
        }
    }
    var res = false;
    var score = [];
    for(w in words) {
        res = trie.getIDs(words[w]);
        if(res != false) {
            for(var item of res.values()) {
                if (!score[item])  {
                    score[item] = {};
                    score[item].id = item;
                    score[item].num = 0;
                }
                score[item].num++;
            }
        }
    }

	var result_num = 0;
	var scores_pruned = [];
	for(var g in score) {
		if(score[g].num > 1) {
			scores_pruned[result_num] = {};
			scores_pruned[result_num].id=score[g].id;
			scores_pruned[result_num].num=score[g].num;
			scores_pruned[result_num].num_words= word_totals[scores_pruned[result_num].id];
			scores_pruned[result_num].jaccard = 1-(score[g].num/(scores_pruned[result_num].num_words+wds_in_q-scores_pruned[result_num].num));
			result_num++;
		}
	}				

// Sort scores_pruned appropriately
	if(jaccard=="true") {
//console_sample(scores_pruned,10,"scores_pruned UNSORTED");
	scores_pruned.sort(function(a, b){return a.jaccard-b.jaccard}); // Ascending, as 0 is identity match
	}
	else scores_pruned.sort(function(a, b){return b.num-a.num}); // Descending
//console_sample(scores_pruned,10,"scores_pruned SORTED");

	// if threshold is set in URL, stop returning results when delta < threshold
	if(threshold > 0) {
		out_array[0]=scores_pruned[0];  // the identity match, or at least the best we have
		for(var p=1;p<scores_pruned.length; p++) {
			var delta =jacc_delta(scores_pruned, p);
			if( delta >= threshold) {
				out_array[p] = scores_pruned[p];
				out_array[p].delta = delta;
			}
			else {
				num_results = p-1;
				break;
			}
		}
	}
	else
	//  return the first num_results results (as JSON?) to the client
		out_array = scores_pruned.slice(0,num_results);
}

function get_query_from_id(id) {
    // return EMO_IDS.indexOf(id); ??
	for(var i=0;i<lines.length;i++) {
		if (lines[i].startsWith(">" + id) || 
            lines[i].startsWith(id)) {
            return lines[i]; }

	}
	return false
}


function initialise() {
	load_maws();
	// load_ngram_database(9);   // Just a magic number that seems to work
}

initialise();
