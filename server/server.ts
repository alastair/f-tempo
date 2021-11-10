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
if (process.env.NODE_ENV === "production") {
    nconf.file('production_config.json')
}

interface StringToString {
    [key: string]: string;
}

interface StringToAny {
    [key: string]: any;
}

export const EMO_IDS: string[] = []; // all ids in the system
export const EMO_IDS_DIAT_MELS: StringToString = {}; // keys are ids, values are the diat_int_code for that id

const TP_JPG_LIST = nconf.get('config:tp_jpg_list');
export const tp_jpgs: string[] = []; // URLs to title-pages (NB only for D-Mbs!)

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

const db_paths = nconf.get('database_files');
// TODO: Make this type actually represent a json db entry
export const db: StringToAny = {};
const storage_location = nconf.get('config:storage');
for (const [key, filename] of Object.entries(db_paths)) {
    console.log(`Loading ${key}`)
    const full_path = path.join(storage_location, filename as string)
    try {
        fs.accessSync(full_path, fs.constants.R_OK)
        const data = fs.readFileSync(full_path);
        db[key] = JSON.parse(data.toString());
    } catch (err) {
        // TODO: This could be any exception, not just file doesn't exist
        console.error(`Cannot find file ${filename} in ${storage_location}`);
    }
}

app.listen(
    nconf.get('server:port'),
    nconf.get('server:host'),
    () => console.log('EMO app listening on port 8000!') // success callback
);

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
