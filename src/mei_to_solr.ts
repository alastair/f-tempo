/// <reference types="./types" />
import yargs from 'yargs'
import {listToNgrams, pageToContourList, pageToNoteList, parseMei} from "./mei.js";
import util from 'util';
import solr from "solr-client";
import path from "path";
import fs from "fs";
import nconf from 'nconf';

nconf.argv().file('default_config.json')

async function saveToSolr(documents: any[]) {
    return new Promise((resolve, reject)=> {
        const client = solr.createClient({host: "localhost", port: 8983, core: 'ngram'});
        client.add(documents, {}, function (err: any, obj: any) {
            if (err) {
                reject(err);
            } else {
                console.log(obj);
                client.commit();
                resolve(obj);
            }
        });
    });
}

function clearSolr() {
    const client = solr.createClient({host: "localhost", port: 8983, core: 'ngram'});
    client.deleteAll( {}, function (err: any, obj: any) {
        if (err) {
            console.error(err);
        } else {
            console.log(obj);
            client.commit();
        }
    });
}

async function processLibrary(librarypath: string, cache: boolean) {
    const data = fs.readFileSync(librarypath);
    const library = JSON.parse(data.toString());
    const meiRoot = nconf.get('config:base_mei_url');
    let documents = [];
    for (const [book_id, book] of Object.entries(library.books)) {
        for (const [page_id, page] of Object.entries((book as any).pages)) {
            const parts = page_id.split("_");
            const library = parts[0];
            const page2 = (page as any);
            const document = makeDocumentFromFile(path.join(meiRoot, library, page2.mei), page2.id, book_id, page2.id, cache)
            if (document) {
                documents.push(document);
            }
            if (documents.length >= 1000) {
                console.log("saving 1000")
                await saveToSolr(documents);
                documents = [];
            }
        }
    }
    if (documents.length) {
        console.log(`saving last ${documents.length}`);
        await saveToSolr(documents);
    }
}


const argv = yargs(process.argv.slice(2)).usage('Parse MEI files to solr')
    .command({
        command: 'clear',
        describe: 'clear solr database',
        handler: clearSolr
    })
    .command({
        command: 'import',
        describe: 'import data to solr',
        handler: importSolr,
        builder: yargs => yargs.options({
            'path': {
                type: 'string',
                description: 'Input file to parse',
                required: false,
                default: undefined
            },
            'dir': {
                type: 'string',
                description: 'path to directory to parse',
                required: false,
                default: undefined
            },
            'library': {
                type: 'string',
                description: 'path to library definition file',
                required: false,
                default: undefined
            },
            'cache': {
                type: 'boolean',
                description: 'if set, cache the mei data',
                required: false,
                default: false
            },
        })
    })
    .argv;

function makeDocumentFromFile(filePath: string, id: string, book: string, page: string, cache: boolean) {
    let meiPage: Page | undefined = undefined;
    const parts = id.split("_");
    const library = parts[0];

    const dirname = path.join('solr', 'cache', 'mei', library, book)
    const fpath = path.join(dirname, `${id}.json`);
    if (cache) {
        try {
            fs.accessSync(fpath, fs.constants.R_OK)
            const data = fs.readFileSync(fpath);
            meiPage = JSON.parse(data.toString());
        } catch (err) {
            // console.info(`Cannot find cache file for ${fpath}`);
        }
    }
    if (meiPage === undefined) {
        try {
            meiPage = parseMei(filePath);
        } catch {
            // Probably means the file isn't there
            return undefined;
        }
    }

    if (cache) {
        fs.mkdirSync(dirname, { recursive: true })
        fs.writeFileSync(fpath, JSON.stringify(meiPage));
    }

    return {
        id: id,
        library: library,
        book: book,
        pageNumber: page,
        page: JSON.stringify(meiPage),
        note_ngrams: listToNgrams(pageToNoteList(meiPage), 3),
        pitch_ngrams: listToNgrams(pageToContourList(meiPage), 3)
    };
}

async function importSolr(argv: any) {
    if (argv.path) {
        const solrDocument = makeDocumentFromFile(argv.path!, '', '', '', false);
        await saveToSolr([solrDocument]);
    } else if (argv.dir) {
        const files = fs.readdirSync(argv.dir);
        let documents = [];
        for (let i = 0; i < files.length; i++) {
            documents.push(makeDocumentFromFile(path.join(argv.dir, files[i]), '', '', '', false));
            if (documents.length >= 1000) {
                await saveToSolr(documents);
                documents = [];
            }
        }
        if (documents.length) {
            await saveToSolr(documents);
        }
    } else if (argv.library) {
        await processLibrary(argv.library, argv.cache);
    } else {
        yargs.showHelp();
    }
}



function pprint(obj: any): string {
    return util.inspect(obj, false, 4, true);
}