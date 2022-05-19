/// <reference types="../lib/types" />
import yargs from 'yargs'
import util from 'util';
import solr from "solr-client";
import path from "path";
import fs from "fs";
import nconf from 'nconf';
import workerpool from 'workerpool';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

nconf.argv().file('./config/default_config.json')
if (process.env.NODE_ENV === "production") {
    nconf.file('./config/production_config.json')
}

const pool = workerpool.pool(
    __dirname + '/../lib/worker.js',
    {maxWorkers: nconf.get('config:import:threads')}
);

const argv = yargs(process.argv.slice(2)).usage('Parse MEI files to solr')
    .command({
        command: 'clear',
        describe: 'clear solr database',
        handler: clearSolr
    })
    .command({
        command: 'import <library>',
        describe: 'import data to solr',
        handler: importSolr,
        builder: yargs =>
            yargs.positional('library', {
                description: 'path to library definition file',
                default: undefined
            }).options({
            'saveCache': {
                type: 'boolean',
                description: 'if set, cache the mei data',
                required: false,
                default: false
            },
            'readCache': {
                type: 'boolean',
                description: 'if set, make the index from saved cache data',
                required: false,
                default: false
            }
        })
    })
    .command({
        command: 'importmei <library>',
        describe: 'import MEI files to solr',
        handler: importMei,
        builder: yargs =>
            yargs.positional('library', {
                description: 'path to library definition file',
                default: undefined
            })
    })
    .command({
        command: 'debug <file>',
        describe: 'Show generated output for a single file',
        handler: debugFile,
        builder: yargs =>
            yargs.positional('file', {
                description: 'path to file to process',
                default: undefined
            })
    })
    .command({
        command: 'debugmei <file>',
        describe: 'Show generated output for an MEI file',
        handler: debugMeiFile,
        builder: yargs =>
            yargs.positional('file', {
                description: 'path to file to process',
                default: undefined
            })
    })
    .demandCommand()
    .argv;

/**
 * Entrypoint for the `clear` command.
 */
async function clearSolr() {
    const client = solr.createClient(nconf.get('search'));
    await client.deleteAll();
}

/**
 * Entrypoint for the `import` command.
 */
async function importSolr(argv: any) {
    if (argv.library) {
        await processLibrary(argv.library, argv.saveCache, argv.readCache);
    } else {
        yargs.showHelp();
    }
}


/**
 * Entrypoint for the `importMei` command.
 */
 async function importMei(argv: any) {
    if (argv.library) {
        await processMeiLibrary(argv.library);
    } else {
        yargs.showHelp();
    }
}


async function processMeiLibrary(librarypath: string) {
    const data = fs.readFileSync(librarypath, 'utf-8');
    const library = JSON.parse(data);

    const inputList: Input[] = []
    const directory_per_book = library.directory_per_book === true;
    for (const [book_id, book] of Object.entries(library.books)) {
        for (const [page_id, page] of Object.entries((book as any).pages)) {
            const parts = page_id.split("_");
            const library = parts[0];
            const page2 = (page as any);
            // The library file says if books are in subdirectories
            // Scores are always in an "mei" subdirectory, either in the library dir, or the book dir
            const book_directory = directory_per_book ? book_id : "";
            const filePath = path.join(library, book_directory, "mei", page2.mei);
            const input: Input = {filePath, library, id: page2.id, book: book_id, page: page2.id, type: 'mxml'}
            inputList.push(input)
        }
    }
    console.log(`got ${inputList.length} items to do`);

    // We assume that we get ~4 parts per MEI file, but we have a limit of 100 items per batch
    // to compute maws, so keep this chunk size quite small
    const chunk = 10;
    const len = inputList.length;
    for (let i = 0; i < len; i += chunk) {
        const items = inputList.slice(i, i + chunk);
        const {doImport} = await import('../lib/mei_to_solr_worker.js');
        const response = doImport(items);
        await saveToSolr(response);
        if (i % (chunk * 10) === 0) {
            await commit();
        }
        console.log(`${Math.min(i+chunk, len)}/${len}`)
    }
}

/**
 * Entrypoint for the `debug` command.
 */
 async function debugFile(argv: any) {
     console.debug(argv)
     if (argv.file) {
         const {doImport} = await import('../lib/mei_to_solr_worker.js');
         const input: [Input] = [{filePath: argv.file, id: "11_11", book: "11", page: "1", library: "x", type: 'aruspix'}]
         const response = doImport(input);
         console.debug(response);
     }
}

/**
 * Entrypoint for the `debugmei` command.
 */
 async function debugMeiFile(argv: any) {
    console.debug(argv)
    if (argv.file) {

        // const {doImport} = await import('../lib/mei_to_solr_worker.js');
        // const input: [Input] = [{filePath: argv.file, id: "cpdl_bookid_pageid", book: "bookid", page: "pageid", library: "cpdl", type: 'mxml'}]
        // const response = doImport(input);
        // console.debug(response);

        const {parseMeiParts} = await import("../lib/mei.js");
        const parts = parseMeiParts('', argv.file);
        for (const p of parts) {
            console.log(p.label!.replaceAll(/[^A-Za-z-_]/g, '_'));
        }
        console.log(parts);

        // for (const fn of argv._) {
        //     try {
        //         const parts = parseMeiParts(fn);
        //         console.log(fn);
        //         console.log(parts.map(p => p.label).join(", "));
        //     } catch {
        //         console.error(`file ${fn} cannot be read`);
        //     }
        // }

    }
}

// TODO: This is duplicated in mei_to_solr_worker
type Input = {
    type: 'aruspix'|'mxml',
    filePath: string,
    id: string,
    library: string,
    book: string,
    page: string,
    notmusic?: boolean,
    titlepage?: string,
}

/**
 * Process a single library file and import into solr
 *
 * In batches of 100:
 *  - Open MEI
 *  - Extract pitches
 *  - Convert pitches to intervals
 *  - Compute MAWs for the full batch of 1000 items at once.
 *
 * We compute the MAWs in a batch because it's much faster than execing to the maw binary
 * once per file (100 items finishes ~5x faster)
 *
 * Use worker_threads to process batches in parallel. The main implementation of the
 * file processing is performed in mei_to_solr_worker.ts. worker.js is used to
 * launch typescript using ts-node, as worker_threads requires that a worker be js.
 *
 * @param librarypath
 * @param doSaveCache
 * @param readCache
 */
async function processLibrary(librarypath: string, doSaveCache: boolean, readCache: boolean) {
    const data = fs.readFileSync(librarypath, 'utf-8');
    const library = JSON.parse(data);

    const inputList: Input[] = []
    const directory_per_book = library.directory_per_book === true;
    for (const [book_id, book] of Object.entries(library.books)) {
        for (const [page_id, page] of Object.entries((book as any).pages)) {
            const parts = page_id.split("_");
            const library = parts[0];
            const page2 = (page as any);
            // The library file says if books are in subdirectories
            // Scores are always in an "mei" subdirectory, either in the library dir, or the book dir
            const book_directory = directory_per_book ? book_id : "";
            const filePath = path.join(library, book_directory, "mei", page2.mei);
            const input: Input = {
                filePath,
                library,
                id: page2.id,
                book: book_id,
                page: page2.id,
                type: 'aruspix'
            };
            if ((book as any).titlepage) {
                input.titlepage = (book as any).titlepage;
            }
            if (page2.notmusic) {
                input.notmusic = page2.notmusic;
            }
            inputList.push(input)
        }
    }
    console.log(`got ${inputList.length} items to do`);

    // This is the number of items that are sent to the `maw` binary at once. It seems
    // to be buggy when processing 1000 (sometimes it doesn't output data for some inputs)
    // but with 100 it seems fine.
    // TODO: Could add this check to the maw generation instead of adding the limit here
    //  so that we can keep large chunks for solr import but still process maws 100 at a time.
    const chunk = readCache ? 2000 : 100;
    const len = inputList.length;
    for (let i = 0; i < len; i += chunk) {
        const items = inputList.slice(i, i + chunk);
        if (readCache) {
            // If we're reading from the cache then don't use the pool, just load chunks and save them
            // Use a larger chunk size as we're not running `maw`
            const documents = readFromCache(items);
            await saveToSolr(documents);
            if (i % (chunk * 10) === 0) {
                await commit();
            }
            console.log(`${Math.min(i+chunk, len)}/${len}`)
        } else if (nconf.get('config:import:threads') === 1) {
            // If we have 1 thread, don't use the pool, sometimes it terminates early
            const {doImport} = await import('../lib/mei_to_solr_worker.js');
            const response = doImport(items);
            await saveToSolr(response);
            if (i % (chunk * 10) === 0) {
                await commit();
            }
            console.log(`${Math.min(i+chunk, len)}/${len}`)
            if (doSaveCache) {
                saveCache(response);
            }
        } else {
            pool.exec('doImport', [items]).then((resp: any[]) => {
                saveToSolr(resp);
                if (i % (chunk * 10) === 0) {
                    commit();
                }
                console.log(`${Math.min(i+chunk, len)}/${len}`);
                if (doSaveCache) {
                    saveCache(resp);
                }
            }).then(function () {
                const stats = pool.stats();
                // This is a bit sketchy - we push all of inputList into the queue as quickly as possible
                // and hope that the first task doesn't terminate before we finish adding items.
                if (stats.activeTasks === 0) {
                    pool.terminate();
                }
            });
        }
    }
    //await commit();
}

/**
 * Load a list of documents to solr
 * @param documents
 */
async function saveToSolr(documents: any[]) {
    const client = solr.createClient(nconf.get('search'));
    const response = await client.add(documents)
    console.log(response);
    //await client.commit();
    return response;
}


async function commit() {
    const client = solr.createClient(nconf.get('search'));
    await client.commit();
}


/**
 * Save a list of documents to a cache file
 * @param documents
 * @param cache
 */
function saveCache(documents: any[]) {
    documents.forEach(doc => {
        const book = doc.book;
        const library = doc.library;

        const dirname = path.join('solr', 'cache', library, book)
        const fpath = path.join(dirname, `${doc.siglum}.json`);
        fs.mkdirSync(dirname, { recursive: true })
        fs.writeFileSync(fpath, JSON.stringify(doc));
    });
}

/**
 * Read json cache files
 * @param files
 */
function readFromCache(files: Input[]) {
    const response: any[] = [];
    files.forEach(input => {
        const dirname = path.join('solr', 'cache', input.library, input.book)
        const fpath = path.join(dirname, `${input.id}.json`);
        try {
            const data = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
            response.push(data);
        } catch {
            //console.error(`No such file? ${fpath}`);
        }
    });
    return response;
}

function pprint(obj: any): string {
    return util.inspect(obj, false, 4, true);
}
