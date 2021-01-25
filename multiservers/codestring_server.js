/*
	Serves the matching codestring in response to a GET request with parameter 'id'.
	
	First it loads all ids/codestrings into a list from DIAT_MEL_DB;
	and then listens on its own port (8500) for http requests
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

var DIAT_MEL_DB = '/storage/ftempo/locations/all/codestrings'; 
const EMO_IDS_DIAT_MELS = {}; // keys are ids, values are the diat_int_code for that id

const port = process.argv[2]; // This should be the port on which to listen (8500)

load_diat_mels();

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
    res.render('index');
});

app.get("/hello", (req, res) => {
  res.send("Hello world");
});

app.post('/api/id', function (req, res) {
	console.log(port+": Codestring request for " + req.body.id)
	if(req.body.id !== undefined) { id = req.body.id;}
	let result;
	if(req.body.id) {
		result = EMO_IDS_DIAT_MELS[id];
		res.send(result)
	}
});
app.listen(
    port,
    () => console.log('Codestring server listening on port '+port+'!') // success callback
);

function load_diat_mels() { load_file(DIAT_MEL_DB, parse_diat_mels_db);}

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

