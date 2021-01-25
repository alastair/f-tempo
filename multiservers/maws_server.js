/*
	Serves the matching array of MAWs in response to a GET request with parameter 'id'.
	
	First it loads all ids/MAWs into a list from MAWS_DB;
	and then listens on its own port (8502) for http requests
*/

const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const fs = require('fs');
const path_app = require('path');
const request = require('request');

// enable CORS without external module
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var MAWS_DB = './data/latest_maws'; 
var EMO_IDS_MAWS = {}; // keys are ids, values are an array of maws for that id
/*
var DIAT_MEL_DB = '/storage/ftempo/locations/all/codestrings'; 
const EMO_IDS_DIAT_MELS = {}; // keys are ids, values are the diat_int_code for that id
*/
const port = process.argv[2]; // This should be the port on which to listen (8502)

load_maws();

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
    res.render('index');
});

app.get("/hello", (req, res) => {
  res.send("Hello world");
});

app.post('/api/id', function (req, res) {
	console.log(port+": MAWs request for " + req.body.id)
	if(req.body.id !== undefined) { id = req.body.id;}
	let result;
	if(req.body.id) {
		result = EMO_IDS_MAWS[id];
		res.send(result)
	}
});
app.listen(
    port,
    () => console.log('Codestring server listening on port '+port+'!') // success callback
);

function load_maws() { load_file(MAWS_DB, parse_maws_db,"basic"); }

var DB_OBJ_LIST = {};
function parse_maws_db(data_str,source) {
    var data_obj = JSON.parse(data_str);
    
//    let lines = data_str.split("\n");
    let IDs = Object.keys(data_obj);
    let words_array = Object.values(data_obj);
    console.log(port+": "+IDs.length + " lines of MAWs to read from "+source+" ...");
    
    const no_maws_ids = [];
    const short_maws_ids = [];
    var line_count = 0;
    for(var i=0;i<IDs.length;i++) {
            const id = IDs[i];
            const words = words_array[i];
            if (words === undefined) { // TODO(ra): how should we handle these?
                no_maws_ids.push(id);
                continue;
            }
//	var item = parse_id(id);
	var uniq_words = Array.from(new Set(words));
	 EMO_IDS_MAWS[id] = uniq_words;
/*
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
*/
	  line_count++;
   }        
   process.stdout.write((("  "+line_count/IDs.length)*100).toFixed(2)+"%"+"\r") 
}

//function load_diat_mels() { load_file(DIAT_MEL_DB, parse_diat_mels_db);}

function parse_diat_mels_db(data_str,source) {
	let lines = data_str.split("\n");
    console.log(lines.length + " lines of diatonic melody strings to read ...");
    var line_count = 0;
    for (let line of lines) {
        if (line) {
            const [id, diat_mels_str] = line.split(/ (.+)/); // splits on first match of whitespace
            if(typeof diat_mels_str != "undefined") EMO_IDS_DIAT_MELS[id] = diat_mels_str;
            line_count++;
        }
        process.stdout.write((("  "+line_count/lines.length)*100).toFixed(2)+"%"+"\r") 
    }
    console.log(Object.keys(EMO_IDS_DIAT_MELS).length+" Diatonic melody strings loaded on port "+port+"!");
}

function load_file(file, data_callback) {
    console.log("Loading " + file + " on port "+port);
    fs.readFile(file, 'utf8', (err, data) => {
        if (err) { throw err; }

        if (!data.length) {
            console.log("No data!");
        } else {
            data_callback(data);
        }
    });
}

