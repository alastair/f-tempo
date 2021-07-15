/*******************************************************************************
 * Imports
 ******************************************************************************/
import bodyParser from 'body-parser';
import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import mustacheExpress from 'mustache-express';
import cors from 'cors';
import nconf from 'nconf';
import api from "./routes/api.js";
import webinterface from "./routes/interface.js";
import path from "path";

/*******************************************************************************
 * Globals / init
 ******************************************************************************/
nconf.argv().file('default_config.json')

interface StringToStringArray {
    [key: string]: string[];
}

interface StringToString {
    [key: string]: string;
}

interface StringToNumber {
    [key: string]: number;
}

export const EMO_IDS: string[] = []; // all ids in the system
export const EMO_IDS_DIAT_MELS: StringToString = {}; // keys are ids, values are the diat_int_code for that id
const EMO_IDS_MAWS: StringToStringArray = {}; // keys are ids, values are an array of maws for that id
const MAWS_to_IDS: StringToStringArray = {}; // keys are maws, values are an array of all ids for which that maw appears

const TP_JPG_LIST = nconf.get('config:tp_jpg_list');
export const tp_jpgs: string[] = []; // URLs to title-pages (NB only for D-Mbs!)


const word_totals: StringToNumber = {}; // total words per id, used for normalization
export const ngr_len = 5;

const app = express();

const databases = nconf.get('databases')
console.log(`Databases = ${databases}`);

export const BASE_IMG_URL = nconf.get('config:base_image_url');
export const BASE_MEI_URL = nconf.get('config:base_mei_url');

/*******************************************************************************
 * Setup
 ******************************************************************************/
console.log("F-TEMPO server started at " + Date());

load_file(TP_JPG_LIST, parse_tp_jpgs, "Titlepage jpegs");

function parse_tp_jpgs(data_str: string) {
    let lines = data_str.split("\n");
    for (let line of lines) {
        if (line) {
            tp_jpgs.push(line);
        }
    }
    console.log(Object.keys(tp_jpgs).length + " title-page urls loaded!");
}

console.log(databases.length + " Databases to load: " + databases);
for (let db of databases) {
    const maws_db = path.join(nconf.get('config:storage'), db, 'all/maws');
    load_file(maws_db, parse_maws_db, db);

    const diat_mel_db = path.join(nconf.get('config:storage'), db, 'all/codestrings');
    load_file(diat_mel_db, parse_diat_mels_db, db);
}

app.listen(
    nconf.get('server:port'),
    nconf.get('server:host'),
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


function load_file(file: string, data_callback: (a: string, b: string) => void, source: string) {
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

function parse_maws_db(data_str: string, source: string) {
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
            const uniq_words: string[] = Array.from(new Set(words));

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
        process.stdout.write(`  ${(line_count / lines.length * 100).toFixed(2)}%\r`);
    }
    EMO_IDS.sort();
    console.log(EMO_IDS.length + " lines of MAW data loaded!");
    console.log(EMO_IDS_MAWS.length + " ids with MAWs data loaded!");
    console.log(Object.keys(MAWS_to_IDS).length + " unique MAWs!");
    console.log(no_maws_ids.length + " empty lines of MAW data rejected!");
    console.log(short_maws_ids.length + " lines with short MAW data rejected!");
}

function parse_diat_mels_db(data_str: string, source: string) {
    let lines = data_str.split("\n");
    console.log(lines.length + " lines of diatonic melody strings to read from " + source + " ...");
    let line_count = 0;
    for (let line of lines) {
        if (line) {
            const [id, diat_mels_str] = line.split(/ (.+)/); // splits on first match of whitespace
            if (typeof diat_mels_str != "undefined") EMO_IDS_DIAT_MELS[id] = diat_mels_str;
            EMO_IDS.push(id);
            line_count++;
        }
        process.stdout.write(`${(line_count / lines.length * 100).toFixed(2)}%\r`);
    }
    console.log(Object.keys(EMO_IDS_DIAT_MELS).length + " Diatonic melody strings loaded!");
}

type MawsLine = {
    id: string,
    words?: string[];
};

function parse_id_maws_line(line: string): MawsLine {

    let [id, maws_str] = line.split(/ (.+)/); // splits on first match of whitespace
    if (id.charAt(0) === '>') { id = id.substring(1); } // remove leading > if it's there
    if (maws_str === undefined) { return {id: id}; }
    const words = maws_str.split(/[ ,]+/).filter(Boolean); // splits rest into words by whitespace
    return {id: id, words: words};
}