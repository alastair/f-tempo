/*******************************************************************************
 * Imports
 ******************************************************************************/
import fs from 'fs';
import path from 'path';

import express, {NextFunction, Request, Response} from 'express';
import fileUpload from 'express-fileupload';

import mustacheExpress from 'mustache-express';
import cors from 'cors';
import nconf from 'nconf';
import * as Sentry from "@sentry/node";

import api from "./routes/api.js";
import webinterface from "./routes/interface.js";


/*******************************************************************************
 * Globals / init
 ******************************************************************************/

if (process.env.FTEMPO_CONFIG) {
    console.log("`FTEMPO_CONFIG` environment variable set");
    if (fs.existsSync(process.env.FTEMPO_CONFIG)) {
        console.log(`Loading config from "${process.env.FTEMPO_CONFIG}"`)
        nconf.argv().file({file: process.env.FTEMPO_CONFIG})
    } else {
        throw new Error(`Cannot find config file ${process.env.FTEMPO_CONFIG}`)
    }
    console.log("Config");
    console.log(nconf.get())
} else {
    console.log("Loading default config");
    nconf.argv().file({file: './config/default_config.json'})
    if (process.env.NODE_ENV === "production") {
        console.log("NODE_ENV=production, Loading production config");
        nconf.file('./config/production_config.json')
    }
}

interface StringToAny {
    [key: string]: any;
}

const TP_JPG_LIST = nconf.get('config:tp_jpg_list');
export const tp_jpgs: string[] = []; // URLs to title-pages (NB only for D-Mbs!)

export const ngr_len = 5;

const app = express();
const hasSentry = process.env.FTEMPO_SENTRY_DSN !== undefined;

if (hasSentry) {
    Sentry.init({
        dsn: process.env.FTEMPO_SENTRY_DSN,
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({tracing: true}),
        ],
        environment: process.env.NODE_ENV === "production" ? "production" : "development"
    });
    app.use(Sentry.Handlers.requestHandler());
}

const databases = nconf.get('databases')
console.log(`Databases = ${databases}`);

export const BASE_IMG_URL = nconf.get('config:base_image_url');
export const BASE_MEI_URL = nconf.get('config:base_mei_url');

let base_route =  nconf.get('config:base_route')
if (!base_route) {
    base_route = "/";
}
export const SERVER_BASE_ROUTE = base_route;

/*******************************************************************************
 * Setup
 ******************************************************************************/
console.log("F-TEMPO server started at " + Date());

// Load Titlepages
console.log("Loading " + TP_JPG_LIST);
fs.readFile(TP_JPG_LIST, 'utf8', (err, data) => {
    if (err) {
        throw err;
    }
    if (!data.length) {
        console.log("No data!");
    } else {
        let lines = data.split("\n");
        for (let line of lines) {
            if (line) {
                tp_jpgs.push(line);
            }
        }
        console.log(Object.keys(tp_jpgs).length + " title-page urls loaded!");
    }
});

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

app.engine('html', mustacheExpress()); // render html templates using Mustache
app.set('view engine', 'html');
app.set('views', './templates');
app.set('view cache', false);

app.use(base_route, express.static('static'))
app.use(fileUpload());
app.use(express.json());
app.use(function(error: Error, request: Request, response: Response, next: NextFunction) {
    // Error handler, for the json parse r, a SyntaxError means that parsing the JSON failed.
    if (error instanceof SyntaxError) {
        return response.status(400).json({error: "Body JSON is invalid"});
    }
    next();
})
app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
app.use(cors());

app.use(base_route, api);
app.use(base_route, webinterface);

if (hasSentry) {
    app.use(Sentry.Handlers.errorHandler());
}
app.use(errorMiddleware);


app.listen(
    nconf.get('server:port'),
    nconf.get('server:host'),
    () => console.log('EMO app listening on port 8000!')
);

function errorMiddleware(error: Error, request: Request, response: Response, next: NextFunction) {
    console.log("in the error middlewore")
    console.log(error)
    if (response.headersSent) {
        return next(error)
    }
    return response.status(500).json({status: 'error', error: 'Unexpected error'})
}