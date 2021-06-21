/*******************************************************************************
 * Imports
 ******************************************************************************/
import bodyParser from 'body-parser';
import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import mustacheExpress from 'mustache-express';
import cors from 'cors';
import minimist from 'minimist';
import api from "./routes/api.js";
import webinterface from "./routes/interface.js";

const argv = minimist(process.argv.slice(2));

/*******************************************************************************
 * Globals / init
 ******************************************************************************/
const D_MBS_ID_PATHS = [];

export const SOLR_HOST = "localhost";

let test = false;
let MAWS_DB = './data/latest_maws';
let DIAT_MEL_DB = './data/latest_diat_mel_strs';
export const EMO_IDS = []; // all ids in the system
export const EMO_IDS_DIAT_MELS = {}; // keys are ids, values are the diat_int_code for that id
const EMO_IDS_MAWS = {}; // keys are ids, values are an array of maws for that id
const MAWS_to_IDS = {}; // keys are maws, values are an array of all ids for which that maw appears
const EMO_IDS_NGRAMS = {}; // keys are ids, values are an array of ngrams for that id
const NGRAMS_to_IDS = {}; // keys are ngrams, values are a array of all ids in whose diat_int_code that ngram appears

const TP_JPG_LIST = "static/src/jpg_list.txt";
export const tp_jpgs = []; // URLs to title-pages (NB only for D-Mbs!)

let collections_to_search;

const word_totals = []; // total words per id, used for normalization
const word_ngram_totals = []; // total words per id, used for normalization
export const ngr_len = 5;

const app = express();
let ARG_LIST = [];

console.log("argv is: " + argv);
if (argv._.length) {
    ARG_LIST = argv._; // Arguments on command-line
    console.log(argv._.length + " arguments");
} else {
    console.log("No arguments");
    const data = load_file_sync("static/src/startup_config");
    const words = data.split(" ");
    for (let i = 0; i < words.length; i++) {
        ARG_LIST.push(words[i]);
    }
}
console.log("ARG_LIST = " + ARG_LIST);

let DB_PREFIX_LIST = []; // Array of prefixes to F_TEMPO data collections

// Goldsmiths-based location of files *excluding D-Mbs* --- CHANGE THIS!!
//const BASE_IMG_URL = 'http://doc.gold.ac.uk/~mas01tc/new_page_dir_50/';
//const BASE_MEI_URL = 'http://doc.gold.ac.uk/~mas01tc/EMO_search/new_mei_pages/';
//const BASE_IMG_URL = '/img/jpg/';
//const BASE_MEI_URL = '/img/mei/';
export const BASE_IMG_URL = 'http://f-tempo-mbs.rism-ch.org/img/jpg/';
//const BASE_MEI_URL = 'http://f-tempo-mbs.rism-ch.org/img/mei/';
export const BASE_MEI_URL = '/var/www/f-tempo/static/img/mei/';

while (ARG_LIST.length > 0) {
    if (ARG_LIST[0].startsWith("Mbs")) {
        const suffix = ARG_LIST[0].substring(3);
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
    } else {
        DB_PREFIX_LIST.push(ARG_LIST.shift().trim());
    }
}

for (let i = 0; i < DB_PREFIX_LIST.length; i++) {
    if (DB_PREFIX_LIST[i].startsWith("Mbs")) {
        if (DB_PREFIX_LIST[i] === "Mbs_all") {
            DB_PREFIX_LIST[i] = "all";
        }
        DB_PREFIX_LIST[i] = "D-Mbs/" + DB_PREFIX_LIST[i];
    }
    console.log(DB_PREFIX_LIST[i]);
}

/*******************************************************************************
 * Setup
 ******************************************************************************/
console.time("Full startup time");
console.log("F-TEMPO server started at " + Date());

load_file(TP_JPG_LIST, parse_tp_jpgs);

function parse_tp_jpgs(data_str) {
    let lines = data_str.split("\n");
    for (let line of lines) {
        var linecount;
        if (line) {
            tp_jpgs.push(line);
        }
    }
    console.log(Object.keys(tp_jpgs).length + " title-page urls loaded!");
}

function parse_Mbs_paths(data_str) {
    let lines = data_str.split("\n");
    for (let line of lines) {
        if (line) {
            D_MBS_ID_PATHS[Mbs_segment] += line + " ";
        }
    }
    return data_str.length;
}

var Mbs_segment;

if ((!DB_PREFIX_LIST.length) || ((DB_PREFIX_LIST.length == 1) && (DB_PREFIX_LIST[0] == "test"))) {
    test = true;
    MAWS_DB = '../../test_data/maws/all';
    DIAT_MEL_DB = '../../test_data/codestrings/all';
    load_maws(); // load the MAWS
    load_diat_mels(); // load the diatonic melodies
} else {
    console.log(DB_PREFIX_LIST.length + " Databases to load: " + DB_PREFIX_LIST);
    for (let m = 0; m < DB_PREFIX_LIST.length; m++) {
        console.log(m);
        let maws_db;
        if (DB_PREFIX_LIST[m].startsWith("D-Mbs")) {
            maws_db = "/storage/ftempo/locations/" + DB_PREFIX_LIST[m] + "/maws";
        }
        else {
            maws_db = "/storage/ftempo/locations/" + DB_PREFIX_LIST[m] + "/all/maws";
        }
        //load_file(maws_db, parse_maws_db,DB_PREFIX_LIST[m]);

        let diat_mel_db;
        if (DB_PREFIX_LIST[m].startsWith("D-Mbs")) {
            diat_mel_db = "/storage/ftempo/locations/" + DB_PREFIX_LIST[m] + "/codestrings";
        } else {
            diat_mel_db = "/storage/ftempo/locations/" + DB_PREFIX_LIST[m] + "/all/codestrings";
        }
        console.log("diat_mel_db is " + diat_mel_db);
        //load_file(diat_mel_db, parse_diat_mels_db, DB_PREFIX_LIST[m]);
    }
}

if (DB_PREFIX_LIST.includes("D-Mbs")) {
    var total_size = 0;
    for (Mbs_segment = 0; Mbs_segment <= 7; Mbs_segment++) {
        let path_file = "/storage/ftempo/locations/Mbs/Mbs" + Mbs_segment;
        total_size += parse_Mbs_paths(load_file_sync(path_file));
    }
    console.log(D_MBS_ID_PATHS.length + " Mbs segments loaded; total size: " + total_size);

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

app.engine('html', mustacheExpress()); // render html templates using Mustache
app.set('view engine', 'html');
app.set('views', './templates');
app.set('view cache', false);

app.use(express.static('static')); // serve static files out of /static
app.use(fileUpload()); // file upload stuff
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
app.use(cors());

app.use("/", api);
app.use("/", webinterface);


function load_file(file, data_callback, source) {
    console.log("Loading " + file);
    fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
            throw err;
        }

        if (!data.length) {
            console.log("No data!");
        } else {
            data_callback(data, source);
        }
    });
}

function load_file_sync(file) {
    if (file.startsWith("http")) {
        var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
        var request = new XMLHttpRequest();
        request.open('GET', file, false);  // `false` makes the request synchronous
        request.send(null);
        if (request.status === 200) {
            return request.responseText;
        }
    } else {
        // console.log("Loading " + file + " synchronously");
        return fs.readFileSync(file, 'utf8');
    }
}

function load_maws() {
    load_file(MAWS_DB, parse_maws_db, "basic");
}

function load_diat_mels() {
    load_file(DIAT_MEL_DB, parse_diat_mels_db, "basic");
}


function parse_maws_db(data_str, source) {
    let lines = data_str.split("\n");
    console.log(lines.length + " lines of MAWs to read from " + source + " ...");

    const no_maws_ids = [];
    const short_maws_ids = [];
    let line_count = 0;
    for (let line of lines) {
        if (line) {
            const parsed_line = parse_id_maws_line(line);
            const id = parsed_line.id;
            const words = parsed_line.words;

            if (words === undefined) { // TODO(ra): how should we handle these?
                no_maws_ids.push(id);
                continue;
            }

            EMO_IDS.push(id);
            const uniq_words = Array.from(new Set(words));

            EMO_IDS_MAWS[id] = uniq_words;
            if (uniq_words.length < 10) {
                short_maws_ids.push(id);
                continue;
            }
            word_totals[id] = uniq_words.length;
            for (const word of uniq_words) {
                if (!MAWS_to_IDS[word]) {
                    MAWS_to_IDS[word] = [];
                }
                MAWS_to_IDS[word].push(id);
            }
            line_count++;
        }
        process.stdout.write((("  " + line_count / lines.length) * 100).toFixed(2) + "%" + "\r");
    }
    EMO_IDS.sort();
    console.log(EMO_IDS.length + " lines of MAW data loaded!");
    console.log(EMO_IDS_MAWS.length + " ids with MAWs data loaded!");
    console.log(Object.keys(MAWS_to_IDS).length + " unique MAWs!");
    console.log(no_maws_ids.length + " empty lines of MAW data rejected!");
    console.log(short_maws_ids.length + " lines with short MAW data rejected!");
}

function parse_diat_mels_db(data_str, source) {
    let lines = data_str.split("\n");
    console.log(lines.length + " lines of diatonic melody strings to read from " + source + " ...");
    var line_count = 0;
    for (let line of lines) {
        if (line) {
            const [id, diat_mels_str] = line.split(/ (.+)/); // splits on first match of whitespace
            if (typeof diat_mels_str != "undefined") EMO_IDS_DIAT_MELS[id] = diat_mels_str;
            EMO_IDS.push(id);
            line_count++;
        }
        process.stdout.write((("  " + line_count / lines.length) * 100).toFixed(2) + "%" + "\r");
    }
    console.log(Object.keys(EMO_IDS_DIAT_MELS).length + " Diatonic melody strings loaded!");
}

function parse_id_maws_line(line) {
    const parsed_line = {};
    let [id, maws_str] = line.split(/ (.+)/); // splits on first match of whitespace
    if (id.charAt(0) === '>') { id = id.substring(1); } // remove leading > if it's there
    parsed_line.id = id;
    if (maws_str === undefined) { return parsed_line; }
    const words = maws_str.split(/[ ,]+/).filter(Boolean); // splits rest into words by whitespace
    parsed_line.words = words;
    return parsed_line;
}