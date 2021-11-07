/// <reference types="./types" />
import yargs from 'yargs'
import {pageToContourList, pageToNoteList, parseMei} from "./mei.js";
import util from 'util';
import solr from "solr-client";
import path from "path";
import fs from "fs";
import nconf from 'nconf';
import {get_maws_for_codestring} from "./maw.js";

nconf.argv().file('default_config.json')

async function saveToSolr(documents: any[]) {
    return new Promise((resolve, reject)=> {
        const client = solr.createClient(nconf.get('search'));
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
    const client = solr.createClient(nconf.get('search'));
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
    const numPages = Object.values(library.books).map(book => {
        return (book as any).page_ids.length;
    }).reduce((c, b) => {
        return ((c as number) + b);
    });
    let count = 0;
    for (const [book_id, book] of Object.entries(library.books)) {
        for (const [page_id, page] of Object.entries((book as any).pages)) {
            const parts = page_id.split("_");
            const library = parts[0];
            const page2 = (page as any);
            const document = await makeDocumentFromFile(path.join(meiRoot, library, page2.mei), page2.id, book_id, page2.id, cache)
            if (document) {
                documents.push(document);
            }
            if (documents.length >= 1000) {
                count += 1000;
                console.log(` ${count}/${numPages}`);
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

type MeiCacheData = {page: Page, maws: string[], notes: string[], intervals: string[]}

async function makeDocumentFromFile(filePath: string, id: string, book: string, page: string, cache: boolean) {
    let data: MeiCacheData | undefined = undefined;

    const parts = id.split("_");
    const library = parts[0];

    const dirname = path.join('solr', 'cache', library, book)
    const fpath = path.join(dirname, `${id}.json`);
    if (cache) {
        try {
            fs.accessSync(fpath, fs.constants.R_OK)
            const filedata = fs.readFileSync(fpath);
            data = JSON.parse(filedata.toString());
        } catch (err) {
            //console.info(`Cannot find cache file for ${fpath}`);
        }
    }
    if (data === undefined) {
        try {
            const page = parseMei(filePath);

            const intervals = pageToContourList(page)
            const maws = await get_maws_for_codestring(intervals.join(''));
            if (!maws) {
                throw Error("maws is empty somehow?")
            }
            
            data = {
                intervals: intervals,
                maws: maws,
                notes: pageToNoteList(page),
                page: page
            }

            if (cache) {
                fs.mkdirSync(dirname, { recursive: true })
                fs.writeFileSync(fpath, JSON.stringify(data));
            }
        } catch {
            // Probably means the file isn't there
            return undefined;
        }
    }

    return {
        siglum: id,
        library: library,
        book: book,
        page_number: page,
        page_data: JSON.stringify(data.page),
        maws: data.maws.join(' '),
        notes: data.notes.join(' '),
        intervals: data.intervals.join(' ')
    };
}

async function importSolr(argv: any) {
    if (argv.library) {
        await processLibrary(argv.library, argv.cache);
    } else {
        yargs.showHelp();
    }
}



function pprint(obj: any): string {
    return util.inspect(obj, false, 4, true);
}