/*******************************************************************************
 * Imports
 ******************************************************************************/
const bodyParser = require('body-parser');
const Color = require('color');
const cp = require('child_process');
const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const mustacheExpress = require('mustache-express');
const path_app = require('path');
const request = require('request');
const utils = require('./static/src/utils.js');
var	argv = require('minimist')(process.argv.slice(2));

/*******************************************************************************
 * Globals / init
 ******************************************************************************/
const dp_prefix = {};
dp_prefix["D-Bsb_"] = "/storage/ftempo/locations/D-Bsb/";
dp_prefix["D-Mbs_"] = "/storage/ftempo/locations/D-Mbs/";
dp_prefix["F-Pn_"] = "/storage/ftempo/locations/F-Pn/";
dp_prefix["GB-Lbl_"] = "/storage/ftempo/locations/GB-Lbl/";
dp_prefix["PL-Wn_"] = "/storage/ftempo/locations/PL_Wn/";

const D_MBS_ID_PATHS = [];

// This function returns the path to the correct subdirectory of D-Mbs data
function get_datapath(id) {
	if(id.startsWith("D-Mbs_")){
		for(var x=0;x<=7;x++) {
			if(D_MBS_ID_PATHS[x].includes(id)) return "D-Mbs/Mbs"+x+"/"+id;
		}
	}
	else {
		return Object.keys(dp_prefix)[id.substr(0,id.indexOf("_")+1)];
	}
}
var test = false;
var MAWS_DB = './data/latest_maws'; 
//const MAWS_DB = './data/latest_maws_corrIDs_30Sep2019.txt'; 
var DIAT_MEL_DB = './data/latest_diat_mel_strs'; 
//const DIAT_MEL_DB = './data/latest_diat_mel_strs_corrIDs_30Sep2019.txt'; 
const EMO_IDS = []; // all ids in the system
const EMO_IDS_DIAT_MELS = {}; // keys are ids, values are the diat_int_code for that id
const EMO_IDS_MAWS = {}; // keys are ids, values are an array of maws for that id
const MAWS_to_IDS = {}; // keys are maws, values are an array of all ids for which that maw appears
const EMO_IDS_NGRAMS = {}; // keys are ids, values are an array of ngrams for that id
const NGRAMS_to_IDS = {}; // keys are ngrams, values are a array of all ids in whose diat_int_code that ngram appears

const NGRAM_ID_BASE = "./data/ngram_id_dict_";
const ID_NGRAM_BASE = "./data/id_ngram_dict_";

var TP_JPG_LIST = "static/src/jpg_list.txt";
const tp_jpgs = []; // URLs to title-pages (NB only for D-Mbs!)

var search_ids = []; // list of ids to search - constructed from EMO_IDS as required
var COLLECTIONS_TO_SEARCH=["D-Bsb","D-Mbs","F-Pn","GB-Lbl","PL-Wn"];
var PAGES_TO_SEARCH=[];

const word_totals = []; // total words per id, used for normalization
const word_ngram_totals = []; // total words per id, used for normalization
const ngr_len = 5;

const app = express();
var ARG_LIST = [];

console.log("argv is: " + argv)
if(argv._.length) {
	ARG_LIST = argv._; // Arguments on command-line
console.log(argv._.length+" arguments")
}
else {
console.log("No arguments")
	var data = load_file_sync("static/src/startup_config")
	var words = data.split(" ");
	for(var i=0;i<words.length;i++) {
		ARG_LIST.push(words[i]);
	}
}
console.log("ARG_LIST = "+ARG_LIST)
/**/

var DB_PREFIX_LIST = []; // Array of prefixes to F_TEMPO data collections

// Goldsmiths-based location of files *excluding D-Mbs* --- CHANGE THIS!!
//const BASE_IMG_URL = 'http://doc.gold.ac.uk/~mas01tc/new_page_dir_50/';
//const BASE_MEI_URL = 'http://doc.gold.ac.uk/~mas01tc/EMO_search/new_mei_pages/';
//const BASE_IMG_URL = '/img/jpg/';
//const BASE_MEI_URL = '/img/mei/';
const BASE_IMG_URL = 'http://f-tempo-mbs.rism-ch.org/img/jpg/';
const BASE_MEI_URL = 'http://f-tempo-mbs.rism-ch.org/img/mei/';

// flags to say whether the current id comes from D-Mbs or elsewhere (in app.get('/compare' ..., below)
// If true, page-image MEI files are local; otherwise they need to be downloaded via http 
var q_Mbs = true;
var m_Mbs = true;

while (ARG_LIST.length > 0) {
		if(ARG_LIST[0].startsWith("Mbs")){
			var suffix = ARG_LIST[0].substring(3);
			switch (suffix) {
				case "0":
				case "1":
				case "2":
				case "3":
				case "4":
				case "5":
				case "6":
				case "7":
				case "_all":
					DB_PREFIX_LIST.push(ARG_LIST.shift());
					break;
				default:
					ARG_LIST.shift(); // Throw away garbage/illegal arguments
					break;
			}
		}
		else {
			DB_PREFIX_LIST.push(ARG_LIST.shift().trim());
		}
}
for(i=0;i<DB_PREFIX_LIST.length;i++) {
	if(DB_PREFIX_LIST[i].startsWith("Mbs")) {
		if(DB_PREFIX_LIST[i]=="Mbs_all") DB_PREFIX_LIST[i] = "all"
		DB_PREFIX_LIST[i]="D-Mbs/"+DB_PREFIX_LIST[i];
	}
console.log(DB_PREFIX_LIST[i]);
}

/*******************************************************************************
 * Setup
 ******************************************************************************/
console.time("Full startup time");
console.log("F-TEMPO server started at "+Date());

load_file(TP_JPG_LIST,parse_tp_jpgs);

function parse_tp_jpgs(data_str) {
        let lines = data_str.split("\n");
    for (let line of lines) {
	var linecount;
        if (line) {
		tp_jpgs.push(line);
        }
    }
    console.log(Object.keys(tp_jpgs).length+" title-page urls loaded!");
}

function parse_Mbs_paths(data_str) {
	let lines = data_str.split("\n");
	for (let line of lines) {
		if(line) {
			D_MBS_ID_PATHS[Mbs_segment] += line+" ";
		}
	}
	return data_str.length;
}
var Mbs_segment;

if((!DB_PREFIX_LIST.length)||((DB_PREFIX_LIST.length==1)&&(DB_PREFIX_LIST[0]=="test"))) {
	test = true;
	MAWS_DB = '../../test_data/maws/all'; 
	DIAT_MEL_DB = '../../test_data/codestrings/all'; 
	load_maws(); // load the MAWS
	load_diat_mels(); // load the diatonic melodies
}else {
	console.log(DB_PREFIX_LIST.length+" Databases to load: "+DB_PREFIX_LIST);
	for (var m=0;m<DB_PREFIX_LIST.length;m++) {
		console.log(m)
// Comment out the next 5 lines on the 'real' server, where D-Mbs files will be present.
//		if(DB_PREFIX_LIST[m].startsWith("D-Mbs")) {
//			console.log("D-Mbs not available on this server");
//			process.exit();
//			continue;
//		}
		if(DB_PREFIX_LIST[m].startsWith("D-Mbs")) var maws_db = "/storage/ftempo/locations/"+DB_PREFIX_LIST[m]+"/maws";
		else var maws_db = "/storage/ftempo/locations/"+DB_PREFIX_LIST[m]+"/all/maws";
		load_file(maws_db, parse_maws_db,DB_PREFIX_LIST[m]);

		if(DB_PREFIX_LIST[m].startsWith("D-Mbs")) var diat_mel_db = "/storage/ftempo/locations/"+DB_PREFIX_LIST[m]+"/codestrings";
		else var diat_mel_db = "/storage/ftempo/locations/"+DB_PREFIX_LIST[m]+"/all/codestrings";
		console.log("diat_mel_db is "+diat_mel_db);
		load_file(diat_mel_db, parse_diat_mels_db, DB_PREFIX_LIST[m]);
	}
}

if(DB_PREFIX_LIST.includes("D-Mbs")) {
	var total_size = 0;
	for(Mbs_segment=0;Mbs_segment<=7;Mbs_segment++) {
		let path_file = "/storage/ftempo/locations/Mbs/Mbs"+Mbs_segment;
		total_size += parse_Mbs_paths(load_file_sync(path_file));
	}
	console.log(D_MBS_ID_PATHS.length+" Mbs segments loaded; total size: "+total_size);

}
// This doesn't work, as loading is asynchronous!
console.timeEnd("Full startup time");

const port = 8000;
app.listen(
    port,
    () => console.log('EMO app listening on port 8000!') // success callback
);

app.engine('html', mustacheExpress()); // render html templates using Mustache
app.set('view engine', 'html');
app.set('views', './templates');

app.use(express.static('static')); // serve static files out of /static
app.use(fileUpload()); // file upload stuff
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

/*******************************************************************************
 * Request handlers
 ******************************************************************************/

app.get('/', function (req, res) {
    res.render('index');
});


app.get('/id_searches', function (req, res) {
    const data = { id_searches: true };
    res.render('index', data);
});

app.get('/code_searches', function (req, res) {
    const data = { code_searches: true };
    res.render('index', data);
});

app.get('/compare', function (req, res) {

    // q for 'query', m for 'match'
    const q_id = req.query.qid;
    const m_id = req.query.mid;
    
    if(req.query.ng_len) var ngram_length = req.query.ng_len;
    else var ngram_length = ngr_len;

    if (!q_id || !m_id) { return res.status(400).send('q_id and m_id must be provided!'); }

    // Because D-Mbs MEI files are stored locally, we need to load them differently than those from URLs
    // q_Mbs and m_Mbs are globals
//    if (get_collection_from_id(q_id) == "D-Mbs")  q_Mbs = true;
//    if (get_collection_from_id(m_id) == "D-Mbs")  m_Mbs = true;
    if (parse_id(q_id).RISM == "D-Mbs")  q_Mbs = true;
    if (parse_id(m_id).RISM == "D-Mbs")  m_Mbs = true;

// Get page-images for query and match
    const img_ext = '.jpg';
    const base_img_url = BASE_IMG_URL;
    const q_jpg_url = base_img_url + q_id + img_ext;
    const m_jpg_url = base_img_url + m_id + img_ext;

//    Get both MEI files
    const mei_ext = '.mei';
    const base_mei_url = BASE_MEI_URL;
    var q_mei_url = base_mei_url + q_id + mei_ext;
    var m_mei_url = base_mei_url + m_id + mei_ext;

    //EMO_IDS_DIAT_MELS lists ids and codestrings;
    // this finds the line of the query and result pages
    const q_diat_str = EMO_IDS_DIAT_MELS[q_id];
    const m_diat_str = EMO_IDS_DIAT_MELS[m_id];
    if (!q_diat_str) { return res.status(400).send('Could not find melody string for this q_id '+q_id); }
    if (!m_diat_str) { return res.status(400).send('Could not find melody string for this m_id: '+m_id); }
    
	function ngram_string(str, n) {
	// Returns array of ngrams of length n
		if(!str.length) return false;
		ngrams = [];
		if(str.length<n) {
			ngrams.push(str + "%");
		}
		else if (str.length==n) {
			ngrams.push(str);
			}
			else {  
				for(i=0; i+n <= str.length; i++) {
					ngrams.push(str.substr(i,n));
				}
			}
		return ngrams;
	}
	function isInArray(value, array) {
	  return array.indexOf(value) > -1;
	}
	function exists(search,arr ) {
		return arr.some(row => row.includes(search));
	}

	function allIndexOf(str, findThis) {
		var indices = [];
		for(var pos = str.indexOf(findThis); pos !== -1; pos = str.indexOf(findThis, pos + 1)) {
			indices.push(pos);
		}
		return indices;
	}

	function ngrams_in_common(q_str,m_str,n,query) {
	// Records all locations of each ngram common to query and match
		let q_com_ng_loc = [];
		let m_com_ng_loc = [];
		let q_ngrams = ngram_string(q_str, n);
		let m_ngrams = ngram_string(m_str, n);
		let qcount = mcount = -1;
		let mlocs = [];
		let qlocs = [];
		for(var i=0;i<=q_ngrams.length;i++) {
			qlocs = allIndexOf(m_str,q_ngrams[i]);
			for(j=0;j<=qlocs.length;j++ ) {
				if(qlocs[j]>=0) {
					if(!exists(qlocs[j],q_com_ng_loc)) {
						if(typeof q_com_ng_loc[i] === "undefined") {
							q_com_ng_loc[i]=[];
						}
						var entry = {};
						entry.q_ind = i;
						entry.m_ind = qlocs[j];
						q_com_ng_loc[i].push(entry);
					}
				}
			}
		}
		for( i=0;i<=m_ngrams.length;i++) {
			mlocs = allIndexOf(q_str,m_ngrams[i]);
			for(j=0;j<=mlocs.length;j++ ) {
				if(mlocs[j]>=0) {
					if(!exists(mlocs[j],m_com_ng_loc)) {
						if(typeof m_com_ng_loc[i] === "undefined") {
							m_com_ng_loc[i]=[];
						}
						var entry = {};
						entry.m_ind = i;
						entry.q_ind = mlocs[j];
						m_com_ng_loc[i].push(entry);
					}
				}
			}
		}

		if(query) return q_com_ng_loc.filter(Boolean); //remove null entries
		else return m_com_ng_loc.filter(Boolean); //remove null entries
	}

	var q_comm = ngrams_in_common(q_diat_str,m_diat_str,ngram_length,true);
	var m_comm = ngrams_in_common(q_diat_str,m_diat_str,ngram_length,false);

	const sorted_q_comm = q_comm.sort(function(a, b){return a[0].q_ind - b[0].q_ind});
	const sorted_m_comm = m_comm.sort(function(a, b){return a[0].m_ind - b[0].m_ind});

    // TODO(ra) probably expose this in the frontend like this...
//	const show_top_ngrams = req.body.show_top_ngrams;
//	const show_top_ngrams = true;
    const show_top_ngrams = false;
    const [q_index_to_colour, m_index_to_colour] = generate_index_to_colour_maps(q_diat_str, m_diat_str, show_top_ngrams);

	let q_mei = "";
	let m_mei = "";
	var ok = false;
console.log("Getting query MEI "+q_mei_url+" from server")
	if(q_Mbs) {
//		q_mei = load_mei(q_mei_url);
		q_mei = load_file_sync(q_mei_url);
		if(!q_mei.length) return res.status(400).send('Could not find the MEI file '+q_mei_url);
	}
	else {
		request(q_mei_url, function (error, response, q_mei) { 
			if (!error && response.statusCode == 200) {
				ok = true;
			}
			else  return res.status(400).send('Could not find the MEI file '+q_mei_url);
		});
	}
console.log("Done\nGetting match MEI "+m_mei_url+" from server")
	if(m_Mbs) {
//		m_mei = load_mei(m_mei_url);
		m_mei = load_file_sync(m_mei_url);
		if(!m_mei.length) return res.status(400).send('Could not find the MEI file '+m_mei_url);
	}
	else {
		request(m_mei_url, function (error, response, m_mei) { 
			if (!error && response.statusCode == 200) {
				ok = true;
			}
			else  return res.status(400).send('Could not find the MEI file '+q_mei_url);
		});
	}
console.log("Done")
	const  data = {
		q_id,
		m_id,
		q_jpg_url,
		m_jpg_url,
		q_mei: q_mei.replace(/(\r\n|\n|\r)/gm,''), // strip newlines
		m_mei: m_mei.replace(/(\r\n|\n|\r)/gm,''), // strip newlines
		q_diat_str: JSON.stringify(q_diat_str),
		m_diat_str: JSON.stringify(m_diat_str),
		ng_len: ngram_length,
	  }
	res.render('compare', data);
});

var q_diat_str;
var q_diat_url;

// Returns the number of all emo ids
app.get('/api/num_emo_ids', function (req, res) { res.send(EMO_IDS.length+" pages in database"); });

// Returns an array of all emo ids
app.get('/api/emo_ids', function (req, res) { res.send(EMO_IDS); });

// Returns an array of all title-page jpg urls
app.get('/api/title-pages', function (req, res) { res.send(tp_jpgs); });

// Handle a query
app.post('/api/query', function (req, res) {
    // Defaults
    let num_results = 20;
    let jaccard = true;
    let threshold = false;
    let ngram = false;
    collections_to_search = [];

    // Set values if given in query
    if (req.body.jaccard !== undefined) { jaccard = req.body.jaccard; }
    if (req.body.num_results !== undefined) { num_results = req.body.num_results; }
    if (req.body.threshold !== undefined) { threshold = req.body.threshold; }
    if (req.body.ngram_search !== undefined) { ngram = req.body.ngram_search; }
    if (req.body.collections_to_search !== undefined) { collections_to_search = req.body.collections_to_search; }
    if(!(JSON.stringify(collections_to_search)==JSON.stringify(COLLECTIONS_TO_SEARCH))) {
		update_pages_to_search(collections_to_search);
    }
    let result;
    if(req.body.qstring) {
        // console.log('Querying by string...');
        const query = req.body.qstring;
 //       result = search('words', query, jaccard, num_results, threshold, ngram, collections_to_search);
        result = search('words', query, jaccard, num_results, threshold, ngram);
    } else if(req.body.id) {
      //   console.log('Querying by id... '+ngram);
//        if(ngram) result = search('id', req.body.id, jaccard, num_results, threshold, ngram, collections_to_search);
        if(ngram) result = search('id', req.body.id, jaccard, num_results, threshold, ngram);
//        else result = search('id', req.body.id, jaccard, num_results, threshold, ngram, collections_to_search);
        else result = search('id', req.body.id, jaccard, num_results, threshold, ngram);

    } else if(req.body.diat_int_code) {
//        result = search_with_code(req.body.diat_int_code, jaccard, num_results, threshold, ngram, collections_to_search);
        result = search_with_code(req.body.diat_int_code, jaccard, num_results, threshold, ngram);
    }

    res.send(result);
});

var working_path;
// Handle image uploads
app.post('/api/image_query', function(req, res) {
    if (!req.files) { return res.status(400).send('No files were uploaded.'); }

    // this needs to stay in sync with the name given to the FormData object in the front end
    let user_image = req.files.user_image_file;
    const user_id = req.body.user_id;
    const new_filename = user_image.name.replace(/ /g, '_');

    // TODO: this probably breaks silently if the user uploads two files with the
    // same name -- they'll end up in the working directory, which may cause
    // problems for Aruspix
    
    let next_working_dir;
    const user_path = './run/' + user_id + '/';
    if (fs.existsSync(user_path)){
        dirs = fs.readdirSync(user_path);

        // dirs is an array of strings, which we want to sort as ints
        dirs.sort((a, b) => parseInt(a) - parseInt(b));
        last_dir = parseInt(dirs[dirs.length - 1]);
        next_working_dir = last_dir + 1;
    } else {
        fs.mkdirSync(user_path);
        next_working_dir = 0;
    }

//    const working_path = user_path + next_working_dir + '/';
	working_path = user_path + next_working_dir + '/';
    fs.mkdirSync(working_path);

    // Use the mv() method to save the file there
    user_image.mv(working_path + new_filename, (err) => {
        if (err) { return res.status(500).send(err); }
        else {
// console.log("Uploaded file saved as " + working_path + new_filename);
            const ngram_search = false; // TODO(ra): make this work!
            const result = run_image_query(user_id, new_filename, working_path, ngram_search);
            if (result) { res.send(result); }
            else { return res.status(422).send('Could not process this file.'); }
        }
    });
});

app.post('/api/log', function(req, res) {
    const log_entry = req.body.log_entry;
    const log = req.body.log;
    if (!log_entry) { return res.status(400).send('No report was provided.'); }
    if (!log) { return res.status(400).send('No log was specified.'); }

    fs.appendFileSync('./logs/' + log, log_entry)

    res.send(

`Successfully logged:
    ${log_entry}
to log ${log}.`

    );
});

/*******************************************************************************
 * Query functions
 ******************************************************************************/

// The subset of pages (ids) to be searched needs to be updated whenever the user 
// changes their selection of collections to search in the UI; otherwise this will just 
// delay the search, as the new collections argument comes with the URL -- To be done!
function update_pages_to_search(collections) {
console.time("update_pages_to_search")
	PAGES_TO_SEARCH.length = 0; //clear the arrays - is this necessary?
	MAWS_to_IDS.length = 0;
console.time("get_multiple_RISM_words")
	PAGES_TO_SEARCH = get_multiple_RISM_words(collections);
console.timeEnd("get_multiple_RISM_words")
/*
	for(var i=0; i<PAGES_TO_SEARCH.length;i++) {
		for (const word of PAGES_TO_SEARCH[i].words) {
			if (!MAWS_to_IDS[word]) { MAWS_to_IDS[word] = []; }
			MAWS_to_IDS[word].push(PAGES_TO_SEARCH[i].id);
		}
	}
*/
console.timeEnd("update_pages_to_search")
console.log("Now searching "+PAGES_TO_SEARCH.length+" pages of "+collections)
}


// method can be 'id' or 'words'
// query is a string, either holding the id or a id+maws line
//function search(method, query, jaccard, num_results, threshold, ngram, collections_to_search) {
function search(method, query, jaccard, num_results, threshold, ngram) {
    if (ngram === undefined) { ngram = false; }

    if(!query) { // Need to report this back to browser/user
        console.log("No query provided!");
        return false;
    }
    let words;
    if (method === 'id') { // Query is an ID *from the database*
        if (!(query in EMO_IDS_MAWS)) { // TODO: need to report to frontend
			console.log("ID " + query + " not found in F-TEMPO data!");
			return;
        }
// console.log((ngram=="true")? "NGRAM search":"MAWs search")
        words = ngram? EMO_IDS_NGRAMS[query] : EMO_IDS_MAWS[query];
    } 
    else if (method === 'words') {
        parsed_line = parse_id_maws_line(query);
        words = parsed_line.words;
    }

// Get the list we need to search for candidate IDs from the selected collections
// MAWS_to_IDS was already updated to reflect selection, so we can use that
    let signature_to_ids_dict;
    if (ngram) { signature_to_ids_dict = NGRAMS_to_IDS; }
    else { signature_to_ids_dict = MAWS_to_IDS; }
//    return get_result_from_words(words, signature_to_ids_dict, jaccard, num_results, threshold, ngram,collections_to_search);
    return get_result_from_words(words, signature_to_ids_dict, jaccard, num_results, threshold, ngram);
}

// ** TODO NB: this only supports MAW-based searches at present
//function search_with_code(diat_int_code, jaccard, num_results, threshold, collections_to_search) {
function search_with_code(diat_int_code, jaccard, num_results, threshold) {
    const codestring_path = './run/codestring_queries/';
    let next_working_dir;
    if (!fs.existsSync(codestring_path)){
        fs.mkdirSync(codestring_path);
        next_working_dir = 0;
    } else {
        dirs = fs.readdirSync(codestring_path);
        dirs.sort((a, b) => parseInt(a) - parseInt(b));
        last_dir = parseInt(dirs[dirs.length - 1]);
        next_working_dir = last_dir + 1;
    }
    working_path = codestring_path + next_working_dir + '/';
    if (!fs.existsSync(working_path)){ fs.mkdirSync(working_path); }

    const query_data = cp.execSync('./shell_scripts/codestring_to_maws.sh ' + diat_int_code + ' ' + working_path);
    const query_str = String(query_data); // a string of maws, preceded with an id
//    const result = search('words', query_str, jaccard, num_results, threshold, collections_to_search);
    const result = search('words', query_str, jaccard, num_results, threshold);
    return result;
}

// ** TODO NB: this only supports MAW-based searches at present
//function run_image_query(user_id, user_image_filename, the_working_path, ngram_search, collections_to_search) {
function run_image_query(user_id, user_image_filename, the_working_path, ngram_search) {
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
        } catch (err) { return; } // something broke in the shell script...
// console.log("query is "+query)
//        result = search('words', query, jaccard, num_results, threshold, collections_to_search);
        result = search('words', query, jaccard, num_results, threshold);
    }
    else {
        try {
            query_data = cp.execSync('./shell_scripts/image_to_ngrams.sh ' + user_image_filename + ' ' + the_working_path + ' ' + '9');
            query = String(query_data);
        } catch (err) { return; } // something broke in the shell script...
//        if (query) { result = search('words', query, jaccard, num_results, threshold, true,collections_to_search); }
        if (query) { result = search('words', query, jaccard, num_results, threshold, true); }
    }

    return result;
}

//function get_result_from_words(words, signature_to_ids_dict, jaccard, num_results, threshold, ngram, collections_to_search) {
function get_result_from_words(words, signature_to_ids_dict, jaccard, num_results, threshold, ngram) {
    if (words.length < 6) { // TODO: Need to report to frontend
        // console.log("Not enough words in query.");
        return [];
    }
console.time("search");

// Safety check that the words are all unique:    
    const uniq_words = Array.from(new Set(words));
//    const scores = get_scores(uniq_words, signature_to_ids_dict, ngram, collections_to_search);
    const scores = get_scores(uniq_words, signature_to_ids_dict, ngram);
//console.log(uniq_words.length+" words")
//console.log(Object.keys(scores).length+" scores to prune");
console.time("pruning")
    const scores_pruned = get_pruned_and_sorted_scores(scores, uniq_words.length, jaccard,ngram);
console.timeEnd("pruning")
//console.log("Now pruned to "+scores_pruned.length);
    const result = gate_scores_by_threshold(scores_pruned, threshold, jaccard, num_results);
console.timeEnd("search");
    return result;
}

//function get_scores(words, signature_to_ids_dict, ngram, collections_to_search) {
function get_scores(words, signature_to_ids_dict, ngram) {
    var res = false;
    var scores = {};
console.time("get_scores")
    for (const word of words) {
        const ids = signature_to_ids_dict[word]
        if (!ids) { continue; }
        for(const id of ids) {
		   if (!scores[id]) { scores[id] = 0; }
		   scores[id]++;
        }
    }
console.timeEnd("get_scores")
    return scores;
}

function get_pruned_and_sorted_scores(scores, wds_in_q, jaccard, ngram) {
    var scores_pruned = [];

    // Prune
    for (var id in scores) {
        if (!scores.hasOwnProperty(id)) { continue; }
        if(! PAGES_TO_SEARCH.filter(e=>e.id===id).length>0) {continue;}
        const num = scores[id];
        if(num > 1) {
            result = {};

            const num_words = ngram? word_ngram_totals[id] : word_totals[id];
            result.id = id;
            result.num = num;
            result.num_words = num_words;
            result.codestring = EMO_IDS_DIAT_MELS[id];

            result.jaccard = 1 - (num / (num_words + wds_in_q - num));
if((result.jaccard < 0)&&(num > num_words)) console.log(id+" : num: "+num+" : num_words: "+num_words+" : jaccard: "+result.jaccard)
            scores_pruned.push(result);
        }
    }
console.time("sort")
    // Sort
    if (jaccard) {
        // Ascending, as 0 is identity match
        scores_pruned.sort((a, b) => { return a.jaccard - b.jaccard; });
    }
    else {
        // Descending
        scores_pruned.sort((a, b) => { return b.num - a.num; });
    }
console.timeEnd("sort")
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

function load_maws() { load_file(MAWS_DB, parse_maws_db,"basic"); }
function load_diat_mels() { load_file(DIAT_MEL_DB, parse_diat_mels_db,"basic");}

/* OLD WAY */
/*
function parse_maws_db(data_str,source) {
    let lines = data_str.split("\n");
    console.log(lines.length + " lines of MAWs to read from "+source+" ...");

    const no_maws_ids = [];
    const short_maws_ids = [];
    var line_count = 0;
    for (let line of lines) {
        if (line) {
            parsed_line = parse_id_maws_line(line);
            const id = parsed_line.id;
            const words = parsed_line.words;

            if (words === undefined) { // TODO(ra): how should we handle these?
                no_maws_ids.push(id);
                continue;
            }

            EMO_IDS.push(id);
	var uniq_words = Array.from(new Set(words));

           EMO_IDS_MAWS[id] = uniq_words;
            if(uniq_words.length < 10) {
            	short_maws_ids.push(id);
            	continue;
            }
            word_totals[id] = uniq_words.length;
            for (const word of uniq_words) {
                if (!MAWS_to_IDS[word]) { MAWS_to_IDS[word] = []; }
                MAWS_to_IDS[word].push(id);
            }
        line_count++;
        }
       process.stdout.write((("  "+line_count/lines.length)*100).toFixed(2)+"%"+"\r") 
    }

    console.log(EMO_IDS.length + " lines of MAW data loaded!");
    console.log(EMO_IDS_MAWS.length + " ids with MAWs data loaded!");
    console.log(Object.keys(MAWS_to_IDS).length + " unique MAWs!");
    console.log(no_maws_ids.length + " empty lines of MAW data rejected!");
    console.log(short_maws_ids.length + " lines with short MAW data rejected!");
}
*/
/**/
/* NEW WAY 29 June 2020 */
/*

// ARE THESE NEEDED?
 function getCollection(RISM) {
	 for(var item in DB_OBJ_LIST[RISM]) {
console.log(item)
		 var collectionKeys = Object.keys(item);
console.log("   "+collectionKeys)
//		 var collectionKeys = Object.keys(collections);
		 for(var i=0; i<collectionKeys.length; i++) {
			var collection = DB_OBJ_LIST[collectionKeys[i]];
//			var collection = collections[collectionKeys[i]];
			}
	}
	var bookKeys = Object.keys(collection);
 	for(var j=0; j<bookKeys.length; j++){
 		var book = collection[bookKeys[j]];
	}
	return book;
}
*/
function ensureKey(key, dataset){
 if(!(key in dataset)) dataset[key] = {};
 return dataset[key];
}

var DB_OBJ_LIST = {};
function parse_maws_db(data_str,source) {
    let lines = data_str.split("\n");
    console.log(lines.length + " lines of MAWs to read from "+source+" ...");

    const no_maws_ids = [];
    const short_maws_ids = [];
    var line_count = 0;
    for (let line of lines) {
        if (line.length) {
            const line_obj = parse_id_maws_line(line);
            const id = line_obj.id;
            const words = line_obj.words;
            if (words === undefined) { // TODO(ra): how should we handle these?
                no_maws_ids.push(id);
                continue;
            }
            var item = parse_id(id);
            
            EMO_IDS.push(id);
            // for safety, check each of the words only occurs once:
            var uniq_words = Array.from(new Set(words));
            
            // EMO_IDS_MAWS needs to contain MAWs for the whole database
            // as, although we don't always search it all, the query ids
            // may be from collections outside the search-selection
            EMO_IDS_MAWS[id] = uniq_words; 
            if(uniq_words.length < 10) {
            	short_maws_ids.push(id);
            	continue;
            }
            var coll = ensureKey(item.RISM,DB_OBJ_LIST);
            var book = ensureKey(item.book,coll);
            var page = ensureKey(item.page,book);
            book[item.page] = uniq_words;

            word_totals[id] = uniq_words.length;
            for (const word of uniq_words) {
                if (!MAWS_to_IDS[word]) { MAWS_to_IDS[word] = []; }
                MAWS_to_IDS[word].push(id);
            }
      line_count++;
        }
       process.stdout.write((("  "+line_count/lines.length)*100).toFixed(2)+"%"+"\r") 
    }

    console.log(Object.keys(DB_OBJ_LIST).length + " collections loaded!");

/*
console.log("\nTesting, testing ...")

for(collection in DB_OBJ_LIST) {
	console.log("Collection: " + collection);
	var count=0;
	for (book in DB_OBJ_LIST[collection]){
		console.log("\tBook "+(count+1)+" : "+book)
		var page=Object.keys(DB_OBJ_LIST[collection][book])
	//	for(var i=0;i<3;i++) {
	//		console.log("\t\tPage: "+page[i]);
	//		if(typeof page[i] != "undefined"){
	//			console.log("\t\t\tMaws beginning with: "+DB_OBJ_LIST[collection][book][page[i]][0])
	//		}
	//	}
		count++;
		if(count==2) break;
	}
	console.log("\t ... etc.")
}

//console.log("Pages of book GB-Lbl_A103a:\n"+Object.keys(DB_OBJ_LIST["GB-Lbl"]["A103a"]));
//console.log("MAWs for GB-Lbl_A103a_004_0:\n"+Object.values(DB_OBJ_LIST["GB-Lbl"]["A103a"]["004_0"]));
//console.log(get_book_words("GB-Lbl_A103_2_050_1").length + " pages in GB-Lbl_A103_2");

var RISM_words = get_RISM_words("F-Pn")
console.log(RISM_words.length + " pages in F-Pn");
var coll_word_tot=0;
for(var p=0;p<RISM_words.length;p++) {
	coll_word_tot += RISM_words[p].words.length;
}
console.log(coll_word_tot + " MAWs in collection F-Pn")

//console.log("Page 2750: \n     " + JSON.stringify(get_all_words()[2750].words))
//console.log(get_all_words()[2750].words.length + " MAWs")
var db_word_tot = 0;
var all_words=[];
all_words=get_all_words();
console.log(all_words.length + " pages in database");
for(var q=0;q<1000;q++) { // At this point the data is not fully loaded so we can't count full database
	db_word_tot += all_words[q].words.length;
}
console.log(db_word_tot + " MAWs in 1000 pages of database ("+(q)+" pages)")

console.log(get_book_words("GB-Lbl_A103_2").length + " pages in GB-Lbl_A103_2");
var book_word_tot=0;
for(var i=0;i<get_book_words("GB-Lbl_A103_2").length;i++) {
	book_word_tot += get_book_words("GB-Lbl_A103_2")[i].words.length;
}
console.log(book_word_tot + " MAWs in GB-Lbl_A103_2")

console.log(Object.keys(get_page_words("GB-Lbl_A103_2_050_1").words).length + " MAWs in GB-Lbl_A103_2_050_1");
console.log("Concatenated GB-Lbl and D-Mbs have "+get_multiple_RISM_words(["GB-Lbl","D-Mbs"]).length + " pages")

console.log("Testing ends\n")
*/

    console.log(EMO_IDS.length + " lines of MAW data loaded!");
    console.log(Object.keys(EMO_IDS_MAWS).length + " ids with MAWs data loaded!");
    console.log(Object.keys(MAWS_to_IDS).length + " unique MAWs!");
    console.log(no_maws_ids.length + " empty lines of MAW data rejected!");
    console.log(short_maws_ids.length + " lines with short MAW data rejected!");
}

function parse_diat_mels_db(data_str,source) {
	let lines = data_str.split("\n");
    console.log(lines.length + " lines of diatonic melody strings to read from "+source+" ...");
    var line_count = 0;
    for (let line of lines) {
        if (line) {
            const [id, diat_mels_str] = line.split(/ (.+)/); // splits on first match of whitespace
            if(typeof diat_mels_str != "undefined") EMO_IDS_DIAT_MELS[id] = diat_mels_str;
            line_count++;
        }
        process.stdout.write((("  "+line_count/lines.length)*100).toFixed(2)+"%"+"\r") 
    }
    console.log(Object.keys(EMO_IDS_DIAT_MELS).length+" Diatonic melody strings loaded!");

}

function load_ngrams_from_diat_mels (ng_len) {
	for(let id in EMO_IDS_DIAT_MELS) {
		if((typeof EMO_IDS_DIAT_MELS[id] != "undefined")&&(EMO_IDS_DIAT_MELS[id].length > ng_len)) {
			EMO_IDS_NGRAMS[id] = utils.ngram_array_as_set(EMO_IDS_DIAT_MELS[id],ng_len);
		}
	}
	var id_total = Object.keys(EMO_IDS_NGRAMS).length;
	var id_count = 0;
	console.log("Generated "+ng_len+"-grams for "+id_total+" IDs.");
	var id_keys = Object.keys(EMO_IDS_NGRAMS);
	var ngram_array = Object.values(EMO_IDS_NGRAMS);
	for(id in id_keys) {
		var ngrams = ngram_array[id];
		word_ngram_totals[id_keys[id]] = ngrams.length;
		for (var ngram in ngrams) {
			if(!NGRAMS_to_IDS[ngrams[ngram]]) { 
				NGRAMS_to_IDS[ngrams[ngram]] = [];
			}
			NGRAMS_to_IDS[ngrams[ngram]].push(id_keys[id]);
		}
		id_count++;
		process.stdout.write((("  "+id_count/id_total)*100).toFixed(2)+"%"+"\r") 
	}
	console.log("There are "+Object.keys(NGRAMS_to_IDS).length+" unique "+ng_len+"-grams");

/*
	// Write out the two arrays to disk
	fs.writeFile(NGRAM_ID_BASE+ng_len+".json",
		JSON.stringify(NGRAMS_to_IDS),
		(err) => {
		  if (err) throw err;
		  console.log('The ngram_id_dict has been saved!');
		}
	);
	fs.writeFile(ID_NGRAM_BASE+ng_len+".json",
		JSON.stringify(EMO_IDS_NGRAMS),
		(err) => {
		  if (err) throw err;
		  console.log('The id_ngram_dict has been saved!');
		}
	);
*/
}

function load_file(file, data_callback,source) {
    console.log("Loading " + file);
    fs.readFile(file, 'utf8', (err, data) => {
        if (err) { throw err; }

        if (!data.length) {
            console.log("No data!");
        } else {
            data_callback(data,source);
        }
    });
}

function load_file_sync(file) {
	if(file.startsWith("http")) {
		var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
		var request = new XMLHttpRequest();
		request.open('GET', file, false);  // `false` makes the request synchronous
		request.send(null);
		if (request.status === 200) {
		  return request.responseText;
		}
	}
	else {
//	console.log("Loading " + file + " synchronously");
		var data = fs.readFileSync(file, 'utf8');
	}
//	console.log("    "+data.length);
	return data;
}

function load_current_query_diat_str(q_diat_url) { load_file(q_diat_url, get_diat_str); }

function load_image_query_diat_str(q_diat_url) {
	var datastr = load_file_sync(q_diat_url); 
	get_diat_str(datastr);
}

function get_diat_str(data_str) {
console.log("url for mel str is "+q_diat_url);
    const lines = data_str.split("\n");
    console.log("Query string loaded!");
    q_diat_str =  lines[1];	// we want the second line of page.txt
}

function load_mei(url) { load_file(url, get_mei); }
function get_mei(data_str) {
console.log("url for mei is "+url);
    console.log("Query string loaded!");
    return data_str
}


/*******************************************************************************
 * Helpers
 ******************************************************************************/

function get_page_words(id) {  // returns the list (object) of MAWs for a page specified by id
	var parsed_id = parse_id(id);
	var collection = parsed_id.RISM;
	var book = parsed_id.book;
	var page = parsed_id.page;
	var page_obj = {};
	page_obj.id = id;
	page_obj.words = DB_OBJ_LIST[collection][book][page];
	return page_obj;
}
function get_book_words(id) {  // returns array of all the page-objects of the book identified in id
// !! NB The book-naming is broken for F-Pn ids, since they named the images in a bizarre way!!
// Usage: works with either
//	 get_book_words("GB-Lbl_A103_2_050_1") -- useful for 'this book' searches from GUI
// or get_book_words("GB-Lbl_A103_2")
	var parsed_id = parse_id(id);
	var collection = parsed_id.RISM;
	var book = parsed_id.book;
	var book_arr = [];
	var pages=Object.keys(DB_OBJ_LIST[collection][book])
	for(var i=0;i<pages.length;i++) {
		var page_obj={};
		page_obj.id = collection+"_"+book+"_"+pages[i];
		page_obj.words = DB_OBJ_LIST[collection][book][pages[i]];
		book_arr.push(page_obj);
	}
	return book_arr;
}
function get_RISM_words(id) {  // returns array of all page-objects of all books in collection identified in id
// Usage: works with either
//	 get_RISM_words("GB-Lbl_A103_2_050_1") -- useful for 'this collection' searches from GUI
// or get_RISM_words("GB-Lbl_A103_2")
// or get_RISM_words("GB-Lbl")
	var parsed_id = parse_id(id);
	var collection = parsed_id.RISM;
	var coll_arr = [];
	var books=Object.keys(DB_OBJ_LIST[collection]);
	for (var j=0;j<books.length;j++) {
		var pages=Object.keys(DB_OBJ_LIST[collection][books[j]])
		for (var i=0;i<pages.length;i++) {
			var page_obj={};
			page_obj.id = collection+"_"+books[j]+"_"+pages[i];
			page_obj.words = DB_OBJ_LIST[collection][books[j]][pages[i]];			
			coll_arr.push(page_obj);
		}
	}
	return coll_arr;
}
function get_multiple_RISM_words (RISM_array) { // takes array of RISM sigla strings
// Usage: get_multiple_RISM_words(["GB-Lbl","D-Mbs"])
	var full_array = [];
	for(var i=0;i<RISM_array.length;i++) {
		full_array = full_array.concat(get_RISM_words(RISM_array[i]));		
	}
	return full_array;
}
function get_all_words() { // returns array of id/MAW objects for all pages of all books
	all_words_arr = [];
	var collections = Object.keys(DB_OBJ_LIST);
	for(var i=0;i<collections.length;i++) {
		var books = Object.keys(DB_OBJ_LIST[collections[i]]);
		for(j=0;j<books.length;j++) {
			var pages=Object.keys(DB_OBJ_LIST[collections[i]][books[j]])
			for (var k=0;k<pages.length;k++) {
				var page_obj={};
				page_obj.id = collections[i]+"_"+books[j]+"_"+pages[k];
				page_obj.words = DB_OBJ_LIST[collections[i]][books[j]][pages[i]];			
				all_words_arr.push(page_obj);
			}
		}
	}
	return all_words_arr;
}

// An old one - still used in api.get(compare) - (near line 245 above)
// Gets library RISM siglum from beginning of id
function get_collection_from_id(id) {
	return id.substr(0,id.indexOf("_"));
}

// Get library siglum, book siglum and page_code from id
// The book siglum is the section of the id following the RISM siglum
// NB The style of underscore-separation differs between collections
function parse_id(id) {
	let parsed_id = {};
	let segment = id.split("_");   
// The library RISM siglum is always the prefix to the id,
// followed by the first underscore in the id.
	parsed_id.RISM=segment[0];
	switch (parsed_id.RISM) {
		case "D-Mbs":
		case "PL-Wn":
			parsed_id.book = segment[1];
			parsed_id.page = segment[2];
			break;
        	case "F-Pn":
        	case "GB-Lbl": 
			if (segment.length == 4) { 
				parsed_id.book = segment[1];
				parsed_id.page = segment[2]+"_"+segment[3];
			  }
			  else {
				parsed_id.book = segment[1]+"_"+segment[2];
				parsed_id.page = segment[3]+"_"+segment[4];
			  }          
			break;
		case "D-Bsb":
			if(segment.length == 6) {
				parsed_id.book = segment[1]+"_"+segment[2]+"_"+segment[3];
				parsed_id.page = segment[4]+"_"+segment[5];	
			}
			if(segment.length == 7) {
				parsed_id.book = segment[1]+"_"+segment[2]+"_"+segment[3];
				parsed_id.page = segment[4]+"_"+segment[5]+"_"+segment[6];	
			}
	}   
	return parsed_id;
}

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
    //console.log("Median = " + median);
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

//////////////////////////////////////////////////////////////////
/*
From here to end is Ryaan Ahmed's way of colouring matched 
sequences for compare.js, which we don't currently use.
Could be deleted?
*/

// Takes two diatonic melody strings, and returns a pair of arrays
// that maps indicies of the melody to colours,
// if show_top_ngrams, based on the longest ngrams common to both
// else, based on as much overlapping material as possible
function generate_index_to_colour_maps(q_diat_str, m_diat_str, show_top_ngrams) {
    let q_index_to_colour = [];
    let m_index_to_colour = [];

    if (show_top_ngrams) {
        const q_ngrams = [];
        const min_ngram_len = 3; // expose this as a tunable parameter to the frontend?
        for (let ngram_len = q_diat_str.length;
            ngram_len >= min_ngram_len;
            ngram_len--) {
            for(let i = 0; i + ngram_len <= q_diat_str.length; i++) {
                ngram_dict = {
                    ngram: q_diat_str.substr(i, ngram_len),
                    len: ngram_len,
                    pos: i
                };
                q_ngrams.push(ngram_dict);
            }
        }

        function get_all_substr_positions(str, substr) {
            const positions = [];
            let position = str.indexOf(substr);
            while (position !== -1) {
                positions.push(position);
                position = str.indexOf(substr, position + 1);
            }
            return positions;
        }

        const q_matches = [];
        const m_matches = [];

        for (i = 0; i < q_diat_str.length; i++) {
            q_matches.push(-1);
        }
        for (i = 0; i < m_diat_str.length; i++) {
            m_matches.push(-1);
        }


        // This isn't great -- ideally we want some kind of mix of short and long
        // ngrams that gives maximum coverage over both spaces with the minimal number
        // of ngrams...
        let match_idx = 0;
        for (const ngram_dict of q_ngrams) {
            const match_length = ngram_dict.len;
            const q_pos = ngram_dict.pos;
            const ngram_match_positions = get_all_substr_positions(m_diat_str, ngram_dict.ngram);
            if (ngram_match_positions.length) {
                for (pos of ngram_match_positions) {

                    let clean_match = true;
                    for (i = q_pos; i < q_pos + match_length; i++) {
                        if (q_matches[i] != -1) {
                            clean_match = false;
                            break;
                        }
                    }

                    if (!clean_match) { continue; }

                    for (i = pos; i < pos + match_length; i++) {
                        if (m_matches[i] != -1) {
                            clean_match = false;
                            break;
                        }
                    }

                    if (clean_match) {
                        for (i = q_pos; i < q_pos + match_length; i++) {
                            q_matches[i] = match_idx;
                        }
                        for (i = pos; i < pos + match_length; i++) {
                            m_matches[i] = match_idx;
                        }
                        match_idx++;
                    }

                    // console.log(ngram_dict);
                    // console.log(ngram_match_positions);
                }
            }
        }

        // console.log(q_matches);
        // console.log(m_matches);

        function produce_colour(i) {
            const colours = [
                'red',
                'orange',
                'yellow',
                'lime',
                'teal',
                'green',
                'blue',
                'aqua',
                'purple',
            ]

            if (i < colours.length) {
                const base_colour = colours[i];
                const modified_colour = Color(base_colour);
                return modified_colour.hex();
            }

            // else if (i < colours.length * 2) {
            //     // TODO(ra): make these colors better / more distinct...
            //     const base_colour = colours[i % colours.length];
            //     const modified_colour = Color(base_colour).saturate(.25).darken(.25);
            //     return modified_colour.hex();
            // }

            else { return 'grey'; }
        }


        let num_colours = 0;
        const colour_map = {};
        for (i = -1; i < match_idx; i++) {
            if (i === -1) { colour_map[i] = 'grey'; }
            else {
                colour_map[i] = produce_colour(num_colours);
                num_colours++;
            }
        }

        // console.log(colour_map);

        // TODO(ra): use filter / includes probably
        for (i = 0; i < q_matches.length; i++) {
            const match_idx = q_matches[i];
            q_index_to_colour.push(colour_map[match_idx]);
        }

        for (i = 0; i < m_matches.length; i++) {
            const match_idx = m_matches[i];
            m_index_to_colour.push(colour_map[match_idx]);
        }

    } else {

        const ngr_len = 5;

        q_ngrams = [];
        if(q_diat_str.length < ngr_len) {
            q_ngrams.push(q_diat_str + "%");
        } else if (q_diat_str.length == ngr_len) {
            q_ngrams.push(q_diat_str);
        } else {
            for(i = 0; i + ngr_len <= q_diat_str.length; i++) {
                q_ngrams.push(q_diat_str.substr(i, ngr_len));
            }
        }

        var q_common_ngram_locations = [];
        var m_common_ngram_locations = [];

        for(i = 0; i <= q_ngrams.length; i++) {
            var loc = m_diat_str.indexOf(q_ngrams[i]);
            if(loc >= 0) {
                q_common_ngram_locations.push(i);
                m_common_ngram_locations.push(loc);
            }
        }

        function create_colour_index(diat_mel_str, match_locations, ngr_len, match_colour, normal_colour) {
            let remaining_matched_notes;
            const output_array = [];
            for (let i = 0; i < diat_mel_str.length; i++) {
                if (match_locations.indexOf(i) > -1) {
                    // when we find a new start location
                    // we reset remaining_matched_notes
                    remaining_matched_notes = ngr_len;
                }
                if(remaining_matched_notes) {
                    output_array.push(match_colour);
                    remaining_matched_notes--;
                } else {
                    output_array.push(normal_colour);
                }
            }
            return output_array;
        }

        q_index_to_colour = create_colour_index(q_diat_str, q_common_ngram_locations, ngr_len, 'HotPink', 'Teal');
        m_index_to_colour = create_colour_index(m_diat_str, m_common_ngram_locations, ngr_len, 'LightSalmon', 'Teal');
    }

    return [q_index_to_colour, m_index_to_colour];
}
 
