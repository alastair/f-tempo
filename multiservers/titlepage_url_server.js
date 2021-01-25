/*
	Serves the title-page (if available) of the relevant book 
	in response to a GET request with parameter 'id'.
	
	First it loads all ids/tp_urls into a list from ;
	and then listens on its own port (8501) for http requests
*/

const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const fs = require('fs');
const path_app = require('path');
const request = require('request');

const port = process.argv[2]; // This should be the port on which to listen (8500)

var TP_JPG_LIST = "../static/src/jpg_list.txt";
const tp_jpgs = []; // URLs to title-pages (NB only for D-Mbs!)

load_file(TP_JPG_LIST,parse_tp_jpgs);

function parse_tp_jpgs(data_str) {
        let lines = data_str.split("\n");
    for (let line of lines) {
	var linecount;
        if (line) {
		tp_jpgs.push(line);
        }
    }
    console.log(port+": "+Object.keys(tp_jpgs).length+" title-page urls loaded!");
}

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
    res.render('index');
});

app.get("/hello", (req, res) => {
  res.send("Hello world");
});

// Returns an array of all title-page jpg urls
app.get('/api/title-pages', function (req, res) { res.send(tp_jpgs); });

app.get('/api/id', function (req, res) {
	var new_img_src="";
	console.log("Titlepage request for " + req.body.id)
	if(req.body.id !== undefined) { id = req.body.id;}
	let result;
	if(req.body.id) {
		for(var i=0;i<tp_jpgs.length;i++) {
			if(tp_jpgs[i].indexOf(parse_id(id).book)>0) {
	//			get small version of the image via IIIF:
				let bits=tp_jpgs[i].split("/");
				for(var j=0;j<bits.length-1;j++){
					var seg=bits[j];
					if(seg==",500") seg="500,";
					new_img_src += seg+"/";
				}
				new_img_src += bits[j];
				break;
			}
		}
		result = new_img_src;
		res.send(result)
	}
});

app.listen(
    port,
    () => console.log('Titlepage URL server listening on port '+port+'!') // success callback
);

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
		case "D-Bsb":
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
