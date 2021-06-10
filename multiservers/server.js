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
const path = require('path');
const request = require('request');
const utils = require('../static/src/utils.js');
const url = require('url');
var cors = require('cors');
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
const EMO_IDS_TO_SKIP = new Set();
const sorted_EMO_IDS = [];
const EMO_IDS_DIAT_MELS = {}; // keys are ids, values are the diat_int_code for that id
var EMO_IDS_MAWS = {}; // keys are ids, values are an array of maws for that id
const MAWS_to_IDS = {}; // keys are maws, values are an array of all ids for which that maw appears
const EMO_IDS_NGRAMS = {}; // keys are ids, values are an array of ngrams for that id
const NGRAMS_to_IDS = {}; // keys are ngrams, values are a array of all ids in whose diat_int_code that ngram appears

const NGRAM_ID_BASE = "./data/ngram_id_dict_";
const ID_NGRAM_BASE = "./data/id_ngram_dict_";

var TP_JPG_LIST = "static/src/jpg_list.txt";
const tp_jpgs = []; // URLs to title-pages (NB only for D-Mbs!)

var search_ids = []; // list of ids to search - constructed from EMO_IDS as required
var collections_to_search;
var ALL_PORTS = ["8011","8001","8004","8015","8007","8017","8016","8006","8003","8027","8021","8008","8026","8009","8010","8014","8005","8002","8012","8018","8022","8024","8013","8020","8019","8023","8025"]; // default - all 27 ports 

const word_totals = []; // total words per id, used for normalization
const word_ngram_totals = []; // total words per id, used for normalization
const ngr_len = 5;

const app = express();
app.use(cors());
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
const BASE_IMG_URL = 'https://uk-dev-ftempo.rism.digital/img/jpg/';
//const BASE_MEI_URL = 'https://uk-dev-ftempo.rism.digital/img/mei/';
const BASE_MEI_URL = '/storage/ftempo/locations/all/mei/';

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
//		load_file(maws_db, parse_maws_db,DB_PREFIX_LIST[m]);

		if(DB_PREFIX_LIST[m].startsWith("D-Mbs")) var diat_mel_db = "/storage/ftempo/locations/"+DB_PREFIX_LIST[m]+"/codestrings";
		else var diat_mel_db = "/storage/ftempo/locations/"+DB_PREFIX_LIST[m]+"/all/codestrings";
		const skip_filelist = "/storage/ftempo/skip_id_filelist";
		load_file(skip_filelist, load_skipped_files, skip_filelist);
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

// Set up middleware to redirect external queries to server's localhost
// Middleware for distributing search to multiple ports (see multi_search)
const {createProxyMiddleware} = require('http-proxy-middleware');
var curr_req_path = "";
app.use('/api/query_*', createProxyMiddleware({
	pathRewrite: rewriteFunction,
	target: 'http://localhost',
	router: rewriteRouterFunction,
	changeOrigin: true,
}));
function rewriteFunction(path){
	var newpath = "/api/query";
	return newpath; 
}
function rewriteRouterFunction(req) {
	let newport = req.url.substr(-4);
	return 'http://localhost:' + newport;
	}

// for getting codestrings from an id
/*
app.use('/api/get_codestring', createProxyMiddleware({
	target: 'http://localhost',
	router: 'http://localhost:8500',
	method: 'POST',
	pathRewrite: {'/api/get_codestring': '/api/id'},
	changeOrigin: true,
}));
*/
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
    if (get_collection_from_id(q_id) == "D-Mbs")  q_Mbs = true;
    if (get_collection_from_id(m_id) == "D-Mbs")  m_Mbs = true;

// Get page-images for query and match
    const img_ext = '.jpg';
    const base_img_url = BASE_IMG_URL;
/*
    if (get_collection_from_id(q_id) != "D-Mbs") var base_img_url = BASE_IMG_URL;
 */
    const q_jpg_url = base_img_url + q_id + img_ext;
    const m_jpg_url = base_img_url + m_id + img_ext;


//    Get both MEI files
    const mei_ext = '.mei';
    const base_mei_url = BASE_MEI_URL;
/*
    if (get_collection_from_id(q_id) != "D-Mbs") var base_mei_url = BASE_MEI_URL;
*/
    var q_mei_url = base_mei_url + q_id + mei_ext;
    var m_mei_url = base_mei_url + m_id + mei_ext;
console.log("q_mei_url: "+q_mei_url)

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
//    const show_top_ngrams = false;
//    const [q_index_to_colour, m_index_to_colour] = generate_index_to_colour_maps(q_diat_str, m_diat_str, show_top_ngrams);

	let q_mei = get_mei(q_mei_url);
	let m_mei = get_mei(m_mei_url);
	var ok = false;

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
function got_mei(data){};

var q_diat_str;
var q_diat_url;

app.get('/api/get_maws_from_id', function (req, res) { 
	let num_ports = ALL_PORTS.length;
	let id=req.url.substring(req.url.indexOf('=')+1);
	let json="\'{\"id\": \""+id+"\"}\'";
//console.log("MAWs request for " + json)
//	if(req.body.id !== undefined) { id = req.body.id;}
	
	let result="";
	
	for(var i=0;i<num_ports;i++) {
		var port = parseInt(ALL_PORTS[i]);
		let url = 'http://localhost:'+port.toString()+"/api/maws_from_id";
		let command="curl -s -d "+json+" -H 'Content-Type: application/json'  -X POST "+url;
//console.log(command)
		
//		let command="curl -s "+url;	
		result =  cp.execSync(command);
		if(result.length) break;
		}
	if(result.length) res.send(JSON.parse(result).join(" ")); 
//	if(result.length) res.send("MAWs for id "+id+" :<br>"+JSON.parse(result).join(" ")); 
	else res.send("MAWs for id "+id+" not found!!"); 
});

// Returns the number of all emo ids
app.get('/api/num_emo_ids', function (req, res) { 
	let num_ports = ALL_PORTS.length;
	var total_ids = 0; // total number in all d/bs
	for(var i=0;i<num_ports;i++) {
		var port = parseInt(ALL_PORTS[i]);
		let url = 'http://localhost:'+port.toString()+"/api/num_emo_ids"
		let command="curl -s "+url + " | awk '{print $1}'";	
		var result =  cp.execSync(command);
		total_ids += parseInt(result.toString().split(" ")[0]);
		}
	res.send(total_ids+" pages in database"); 
});

// Returns an array of all emo ids
app.get('/api/emo_ids', function (req, res) { res.send(EMO_IDS); });

// Returns a random id from the database
app.get('/api/random_id', function (req, res) { 
	res.send( EMO_IDS[Math.floor(Math.random()*EMO_IDS.length)]); 
});

// Returns a new id (next/previous page/book) in response to that in the request
app.get('/api/next_id', function (req, res) {
// NB FIXME!! This does not work properly with F-Pn IDs, as the 'book' part of the ID is scrambled!
	var next = true; // default to finding next ...
	var page = true; // page
	if(req.query.next !== "undefined") {
		if(req.query.next=="true") next = true;
		else if(req.query.next=="false") next = false;	
	}
	if(req.query.page !== "undefined") {
		if(req.query.page=="true") page = true;	
		else if(req.query.page=="false") page = false;	
	}
	var start_id = req.query.id;
	var new_id = "";
//console.log("next is "+next);
	var found = EMO_IDS.indexOf(start_id);
	if(found == -1) res.send("ID "+start_id+" not found!");
//console.log("found = "+found)
	
	if(page==true) {
		// finding adjacent ID/page
		if(next==true) {
			found+=1;
		} 
		else found-=1;
//	console.log("new found = "+found);
	// TODO handle end and beginning of EMO_IDS properly!! Maybe as simple as ...
		if((found>=EMO_IDS.length)||(found<0)) res.send(start_id);
		new_id = EMO_IDS[found];
//	console.log("ID: "+start_id+" new ID: "+new_id+" ("+next+")");
	}
	else {
		var parsed_id=parse_id(start_id)
		var this_book = parsed_id.book;
		// find next book
//	console.log("Found this_book: "+this_book)
		var new_id = "";
		var new_book = "";
		if(next==true) {
			for(var i=found;i<EMO_IDS.length;i++) {
				new_id = EMO_IDS[i];
				new_book=parse_id(new_id).book;
				if(new_book != this_book) {
					break;
				}
			}
//	console.log(i+": '"+EMO_IDS[i]+"'");
//	console.log("Found next book: "+new_book)
		}
		else {
		// find previous book]
			for(i=found;i>0;i--) {
				new_id = EMO_IDS[i].trim();
				new_book = parse_id(new_id).book;
				if(new_book != this_book) {
					// now we are at the last image of the previous book
					// so find the book before that one and go to next
					// image - it will be the first of the book we want
					this_book = new_book;
					for(;i>0;i--) {
						new_id = EMO_IDS[i].trim();
						new_book = parse_id(new_id).book;
						if(new_book != this_book) {
							if(i>0) i++; // Don't go to next if at first book
							new_id = EMO_IDS[i].trim();
							break;
						}
					}
					break;
				}
			}
//	console.log("Found previous book: "+new_book)
		}
	}
			
	res.send(new_id); 
});

// Returns an array of all title-page jpg urls
app.get('/api/title-pages', function (req, res) { res.send(tp_jpgs); });


app.get('/api/get_codestring', function (req, res) {
	let id = '';
	id=req.url.substring(req.url.indexOf('=')+1);
//	console.log(req.url+ " id is "+id)
	if (typeof id == undefined) {
		// res.send(req.url+" : Can't read the id")
		return false;
	}
	else {
		let json="\'{\"id\": \""+id+"\"}\'";
// console.log(json)
		let command="curl -s -d "+json+" -H 'Content-Type: application/json'  -X POST http://localhost:8500/api/id";
//		console.log("command = "+command)
		let codestring = cp.execSync(command);
//		console.log("Try to get codestring: \n"+codestring);
		res.send(JSON.stringify(codestring.toString().trim()));
	}
});

// Handle a remote query
// Multi-search version; sends identical search to all requested servers on their ports
app.post('/api/query', function (req, res) {

    // Defaults
    let num_results = 20;
    let jaccard = true;
    let threshold = false;
    let ngram = false;
    let ports_to_search = ALL_PORTS; // default - all 27 ports 

    // Set values if given in query
    if (req.body.jaccard !== undefined) { jaccard = req.body.jaccard; }
    if (req.body.num_results !== undefined) { num_results = req.body.num_results; }
    if (req.body.threshold !== undefined) { threshold = req.body.threshold; }
    if (req.body.ngram_search !== undefined) { ngram = req.body.ngram_search; }
    if (req.body.ports !== undefined) { ports_to_search = req.body.ports; }
    let result;
    if(req.body.id) {
        var codestring = get_codestring(req.body.id);
console.log("'"+codestring+"'")
        if(codestring.length <= 2) {
console.log("No codestring found for id: "+req.body.id)
		   res.send(req.body.id+" not found!!");
        }
        else {
		   codestring = "'" + codestring + "'";
		   result = multi_search(codestring, jaccard, num_results, threshold, ngram, ports_to_search);
        }

    } else if(req.body.codestring) {
		let multi_result = multi_search(req.body.codestring, jaccard, num_results, threshold, ngram, ports_to_search);
     }

	var num_ports_to_search;
	var num_ports_searched = 0;
	var multi_results_array = [];

	function search_ports(query,ports,num_results) {
		num_ports_to_search = ports.length
		for(var i=0;i<num_ports_to_search;i++) {
			var port = parseInt(ports[i]);
			let url = 'http://localhost:'+port.toString()+"/api/query"
			let command="curl -s -d "+JSON.stringify(query)+" -H 'Content-Type: application/json'  -X POST "+url;	
			var result =  cp.exec(command,(error,stdout,stderr) => {
			  if (error) {
			    console.error(`exec error: ${error}`);
			    return;
			  }
			handle_multi_results(`${stdout}`,num_results);
			});
		}
			if(result)   return multi_results_array;
	}

	// Multiple remote search function. Repeats identical search for each port.
	// NB Results are dynamically concatenated into multi_results_array
	// - see function handle_multi_results
	 function multi_search(id, jaccard, search_num_results, threshold, ngram_search, ports_to_search) {

	    let codestring = "";
	    // Options for multi_search are by id or by codestring; also by 'word' but we are most unlikely to do that one
	    // crude test whether it's an id or a codestring:
	    if(!EMO_IDS.includes(id)) codestring = id;
	    else codestring = get_codestring(id);

	    let search_data = "";
	    let diat_int_str = codestring;
	    let num_results = search_num_results;
	    search_data = JSON.stringify({ codestring, jaccard, num_results, threshold, ngram_search});
	    let result = search_ports(search_data, ports_to_search,num_results);
	    return result;
	}

	function handle_multi_results(json,trunc_num) {
		num_ports_searched++;
		if(!json.length) return;
		var this_result = "";
		this_result = JSON.parse(json);
		var this_result_array=this_result
		for(var i=0;i<this_result_array.length;i++) {
			let result_line = this_result_array[i];
			multi_results_array=multi_results_array.concat(result_line)
		}
		multi_results_array.sort((a, b) => { return a.jaccard - b.jaccard; });
		multi_results_array.length = trunc_num;
		if(num_ports_searched == num_ports_to_search) {
			res.send(multi_results_array);
		}
	}

});

/*
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
*/

// Handle a remote image-upload query
// Multi-search version; sends identical search to all requested servers on their ports
app.post('/api/image_query', function (req, res) {

    if (!req.files) { return res.status(400).send('No files were uploaded.'); }
    
    let working_path;
    // Defaults
    let num_results = 20;
    let jaccard = true;
    let threshold = false;
    let ngram = false;
    let ports_to_search = ALL_PORTS; // default - all 27 ports 

    // Set values if given in query
    if (req.body.jaccard !== undefined) { jaccard = req.body.jaccard; }
    if (req.body.num_results !== undefined) { num_results = req.body.num_results; }
    if (req.body.threshold !== undefined) { threshold = req.body.threshold; }
// No ngram searches yet!
//    if (req.body.ngram_search !== undefined) { ngram = req.body.ngram_search; }
    ngram = false;
    if (req.body.ports_to_search !== undefined) { ports_to_search = req.body.ports; }
    
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
            const ngram_search = ngram;
            const result = run_multi_image_query(user_id, new_filename, working_path, ngram_search);
 //           if (result) { res.send(result); }
 //           if(!result) { return res.status(422).send('Could not process this file.'); }
        }
    });

    var image_codestring;
    let multi_result = [];
    
    function run_multi_image_query(user_id, new_filename, working_path, ngram_search) {
		multi_result.length = 0;
	    let query_data;
	    let query;
	    if(!ngram_search) {
			  query_data = cp.execSync('./shell_scripts/image_to_codestring.sh ' + new_filename + ' ' + working_path );
			  image_codestring = String(query_data); 
//console.log("image_codestring is: '"+image_codestring+"'")
		   multi_result = multi_search(image_codestring, jaccard, num_results, threshold, false, ports_to_search);
	    }
/* Not yet!
	    else {
		   try {
			  query_data = cp.execSync('./shell_scripts/image_to_ngrams.sh ' + user_image_filename + ' ' + the_working_path + ' ' + '9');
			  query = String(query_data);
		   } catch (err) { return; } // something broke in the shell script...
		   if (query) { multi_result = multi_search(image_codestring, jaccard, num_results, threshold, ngram, ports_to_search); }
	    }
*/
	}

	let num_ports_to_search;
	let num_ports_searched = 0;
	var multi_results_array = [];

	function search_ports(query,ports,num_results) {

		multi_results_array.length=0;
		
		num_ports_to_search = ports.length
		for(var i=0;i<num_ports_to_search;i++) {
			var port = parseInt(ports[i]);
			let url = 'http://localhost:'+port.toString()+"/api/query"
			let command="curl -s -d "+JSON.stringify(query)+" -H 'Content-Type: application/json'  -X POST "+url;	
			var result =  cp.exec(command,(error,stdout,stderr) => {
			  if (error) {
			    console.error(`exec error: ${error}`);
			    return;
			  }
			handle_multi_results(`${stdout}`,num_results);
			});
		}
			if(result)   return multi_results_array;
	}

	// Multiple remote search function. Repeats identical search for each port.
	// NB Results are dynamically concatenated into multi_results_array
	// - see function handle_multi_results
	 function multi_search(codestring, jaccard, search_num_results, threshold, ngram_search, ports_to_search) {
	    let search_data = "";
//	    let diat_int_str = codestring;
	    let num_results = search_num_results;
	    search_data = { codestring, jaccard, num_results, threshold, ngram_search};
//console.log(search_data)
	    let result = search_ports(JSON.stringify(search_data), ports_to_search,num_results);
	    return result;
	}

	function handle_multi_results(json,trunc_num) {
		num_ports_searched++;
		if(!json.length) return;
		var this_result = "";
		this_result = JSON.parse(json);
		var this_result_array=this_result
		for(var i=0;i<this_result_array.length;i++) {
			let result_line = this_result_array[i];
//			multi_results_array=multi_results_array.concat(JSON.stringify(result_line))
			multi_results_array=multi_results_array.concat(result_line)
		}
		multi_results_array.sort((a, b) => { return a.jaccard - b.jaccard; });
		multi_results_array.length = trunc_num;
		if(num_ports_searched == num_ports_to_search) {
//console.log("Sending result: "+multi_results_array)
			res.send(JSON.stringify(multi_results_array));
//			return multi_results_array;
		}
	}

});

app.get('/api/get_coll_ports', function(req,res) {
	    var file = "static/src/coll_port_list";
	    var colls = req.originalUrl.substring(req.originalUrl.indexOf('=')+1);
//console.log(req.originalUrl)
//	    if(colls.length)  console.log("colls requested: "+colls);
	    let  ports_to_search = [];
	    fs.readFile(file, 'utf8', (err, data) => {
		   if (err) { throw err; }
		   if (!data.length) {
			  console.log("No data in seg_server_list!");
		   } else {
			  ports_to_search = parse_ports(data,colls);
//			  console.log("ports_to_search now: "+ports_to_search)
			  res.send(ports_to_search);
		   }
	    });

	function parse_ports(data_str,colls) {
		var ports = []; 
	    if(colls.length) {
			var coll_array = colls.split(",");
			let lines = data_str.split("\n");
//			console.log("Getting search ports for " + coll_array.length + " data-segments");
			for (let line of lines) {
			   if (line) {
				const words = line.split(" "); // splits on whitespace
				// words[0] is the collection RISM siglum
				var coll = words[0];
				if(coll_array.includes(coll))
					for(var i=1;i<words.length;i++) {
						ports.push(words[i]);
					}
			   }
			}
	   }
//	    console.log("ports parsed = " + ports);
	    return ports;
	}
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
// method can be 'id' or 'words'
// query is a string, either holding the id a id+maws line
function search(method, query, jaccard, num_results, threshold, ngram, collections_to_search) {
    if (ngram === undefined) { ngram = false; }

    if(!query) { // Need to report this back to browser/user
        console.log("No query provided!");
        return false;
    }
//console.log(method+"\nquery: "+query+"\njaccard: "+jaccard+"\nnum_results: "+num_results+"\nthreshold: "+threshold+"\nngram: "+ngram+"\ncollections: "+collections_to_search)
    let words;
    if (method === 'id') {
        if (!(query in EMO_IDS_MAWS)) { // TODO: need to report to frontend
 console.log("ID " + query + " not found in F-TEMPO data!");
            return;
        }
// console.log((ngram=="true")? "NGRAM search":"MAWs search")
        words = ngram? EMO_IDS_NGRAMS[query] : EMO_IDS_MAWS[query];
    } else if (method === 'words') {
        parsed_line = parse_id_maws_line(query);
        words = parsed_line.words;
    }

//console.log(ngram? "NGRAM search: " : "MAW search: "+words);
//console.log("Searching ")+ collections_to_search
    let signature_to_ids_dict;
    if (ngram) { signature_to_ids_dict = NGRAMS_to_IDS; }
    else { signature_to_ids_dict = MAWS_to_IDS; }
    return get_result_from_words(words, signature_to_ids_dict, jaccard, num_results, threshold, ngram,collections_to_search);
}

// ** TODO NB: this only supports MAW-based searches at present
function search_with_code(diat_int_code, jaccard, num_results, threshold, collections_to_search) {
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
    const result = search('words', query_str, jaccard, num_results, threshold, collections_to_search);
    return result;
}

// ** TODO NB: this only supports MAW-based searches at present
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
        result = search('words', query, jaccard, num_results, threshold, collections_to_search);
    }
    else {
        try {
            query_data = cp.execSync('./shell_scripts/image_to_ngrams.sh ' + user_image_filename + ' ' + the_working_path + ' ' + '9');
            query = String(query_data);
        } catch (err) { return; } // something broke in the shell script...
        if (query) { result = search('words', query, jaccard, num_results, threshold, true,collections_to_search); }
    }

    return result;
}

function get_result_from_words(words, signature_to_ids_dict, jaccard, num_results, threshold, ngram, collections_to_search) {
    if (words.length < 6) { // TODO: Need to report to frontend
        // console.log("Not enough words in query.");
        return [];
    }
// Safety check that the words are all unique:    
    const uniq_words = Array.from(new Set(words));
    const scores = get_scores(uniq_words, signature_to_ids_dict, ngram, collections_to_search);
    const scores_pruned = get_pruned_and_sorted_scores(scores, uniq_words.length, jaccard,ngram);
    const result = gate_scores_by_threshold(scores_pruned, threshold, jaccard, num_results);
    return result;
}

// Get library siglum, book siglum and page_code from id
// The book siglum is the section of the id following the RISM siglum
// NB The style of underscore-separation differs between collections
function parse_id(id) {
//console.log("ID: "+id)
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
//           	parsed_id.book = segment[1];
//			parsed_id.page = segment[2]+"_"+segment[3];
//            break;
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
	}   
	return parsed_id;
}

function get_scores(words, signature_to_ids_dict, ngram, collections_to_search) {
    var res = false;
    var scores = {};
console.time("get_scores")
    for (const word of words) {
        const ids = signature_to_ids_dict[word]
        if (!ids) { continue; }
        for(const id of ids) {
		   if(!collections_to_search.includes(parse_id(id).RISM)) continue;
		   if(typeof id_list == "undefined"){
		   	if (!scores[id]) { scores[id] = 0; }
			scores[id]++;
		   }
		   else {
		   	if(id_list.includes(id)) {
				if (!scores[id]) { scores[id] = 0; }
				scores[id]++;		   		
		   	}
		   }
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
        const num = scores[id];
        if(num > 1) {
            result = {};

            const num_words = ngram? word_ngram_totals[id] : word_totals[id];
            result.id = id;
            result.num = num;
            result.num_words = num_words;
            result.codestring = EMO_IDS_DIAT_MELS[id];

            result.jaccard = 1 - (num / (num_words + wds_in_q - num));
if((result.jaccard < 0)&&(num > num_words)) console.log("num: "+num+" : num_words: "+num_words+" : jaccard: "+result.jaccard)
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
    EMO_IDS.sort();
    console.log(EMO_IDS.length + " lines of MAW data loaded!");
    console.log(EMO_IDS_MAWS.length + " ids with MAWs data loaded!");
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
            if (EMO_IDS_TO_SKIP.has(id)) {
                continue
            }
            if(typeof diat_mels_str != "undefined") EMO_IDS_DIAT_MELS[id] = diat_mels_str;
            EMO_IDS.push(id);
            line_count++;
        }
        process.stdout.write((("  "+line_count/lines.length)*100).toFixed(2)+"%"+"\r") 
    }
    console.log(Object.keys(EMO_IDS_DIAT_MELS).length+" Diatonic melody strings loaded!");
}

/**
 * Load a list of IDs to ignore, and not load into the database
 * @param data_str
 * @param source
 */
function load_skipped_files(data_str, source) {
    const lines = data_str.split("\n");
    for (let line of lines) {
        EMO_IDS_TO_SKIP.add(line);
    }
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


/*******************************************************************************
 * Helpers
 ******************************************************************************/

function get_codestring(id) {
	let json="\'{\"id\": \""+id+"\"}\'";
	let command="curl -s -d "+json+" -H 'Content-Type: application/json'  -X POST http://localhost:8500/api/id";
	let codestring_found = cp.execSync(command);
	return codestring_found;
}

function get_mei(file) {
//	console.log("Getting MEI from: "+ file)
	var found_mei = fs.readFileSync(file, 'utf8');
	return found_mei;
}

// Gets library RISM siglum from beginning of id
function get_collection_from_id(id) {
	return id.substr(0,id.indexOf("_"));
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
 
