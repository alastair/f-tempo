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
            'cache': {
                type: 'boolean',
                description: 'if set, cache the mei data',
                required: false,
                default: false
            },
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
        await processLibrary(argv.library, argv.cache);
    } else {
        yargs.showHelp();
    }
}

type Input = {
    filePath: string, id: string, book: string, page: string
}

/**
 * Process a single library file and import into solr
 * 
 * In batches of 1000:
 *  - Open MEI
 *  - Extract pitches
 *  - Convert pitches to intervals
 *  - Compute MAWs for the full batch of 1000 items at once.
 * 
 * We compute the MAWs in a batch because it's much faster than execing to the maw binary
 * once per file (1000 items finishes ~5x faster)
 * 
 * Use worker_threads to process batches in parallel. The main implementation of the 
 * file processing is performed in mei_to_solr_worker.ts. worker.js is used to 
 * launch typescript using ts-node, as worker_threads requires that a worker be js.
 * 
 * @param librarypath 
 * @param cache 
 */
async function processLibrary(librarypath: string, cache: boolean) {
    const data = fs.readFileSync(librarypath);
    const library = JSON.parse(data.toString());
    const meiRoot = nconf.get('config:base_mei_url');

    const inputList: Input[] = []
    for (const [book_id, book] of Object.entries(library.books)) {
        for (const [page_id, page] of Object.entries((book as any).pages)) {
            const parts = page_id.split("_");
            const library = parts[0];
            const page2 = (page as any);
            inputList.push({filePath: path.join(meiRoot, library, page2.mei), id: page2.id, book: book_id, page: page2.id})
        }
    }
    console.log(`got ${inputList.length} items to do`);

    // This is the number of items that are sent to the `maw` binary at once. It seems
    // to be buggy when processing 1000 (sometimes it doesn't output data for some inputs)
    // but with 100 it seems fine.
    // TODO: Could add this check to the maw generation instead of adding the limit here
    //  so that we can keep 1000 size chunks but still process maws 10 or 100 at a time.
    const chunk = 100;
    const len = inputList.length;
    for (let i = 0; i < len; i += chunk) {
        const items = inputList.slice(i, i + chunk);
        if (nconf.get('config:import:threads') === 1) {
            // If we have 1 thread, don't use the pool, sometimes it terminates early
            const {doImport} = await import('../lib/mei_to_solr_worker.js');
            const response = doImport(items);
            await saveToSolr(response);
            console.log(`${Math.min(i+chunk, len)}/${len}`)
        } else {
            pool.exec('doImport', [items]).then((resp: any[]) => {
                saveToSolr(resp);
                console.log(`${Math.min(i+chunk, len)}/${len}`)
                // saveCache(documentsWithMaws, cache);
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
}

/**
 * Load a list of documents to solr
 * @param documents 
 */
async function saveToSolr(documents: any[]) {
    const client = solr.createClient(nconf.get('search'));
    const response = await client.add(documents)
    console.log(response);
    await client.commit();
    return response;
}

/**
 * Save a list of documents to a cache file
 * @param documents 
 * @param cache 
 */
function saveCache(documents: any[], cache: boolean) {
    if (cache) {
        documents.forEach(element => {
            const parts = element.id.split("_");
            const book = element.id.split("_");
            const library = parts[0];

            const dirname = path.join('solr', 'cache', library, book)
            const fpath = path.join(dirname, `${element.id}.json`);
            const data = {
                page_number: element.page,
                page_data: JSON.parse(element.page),
                notes: element.notes.split(' '),
                intervals: element.intervals.split(' ')
            }
            fs.mkdirSync(dirname, { recursive: true })
            fs.writeFileSync(fpath, JSON.stringify(data));
        });
    }
}

function pprint(obj: any): string {
    return util.inspect(obj, false, 4, true);
}
