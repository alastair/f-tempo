/// <reference types="./types" />
import { get_maws_for_codestrings } from './maw.js';
import {pageToContourList, pageToNoteList, parseMei} from "./mei.js";
import nconf from 'nconf';
import workerpool from 'workerpool';

nconf.argv().file('./config/default_config.json')
if (process.env.NODE_ENV === "production") {
    nconf.file('./config/production_config.json')
}

// Only bind the pool if we have >1 threads
if (nconf.get('config:import:threads') !== 1) {
    workerpool.worker({
        doImport: doImport
    });
}

type Input = {
    filePath: string,
    id: string,
    library: string,
    book: string,
    page: string,
    notmusic?: boolean,
    titlepage?: string,
}

export function doImport(param: Input[]) {
    const documents = param.map(item => {
        return makeDocumentFromFile(item);
    })
    const mawDocuments = addMaws(documents.filter(d => {return d !== undefined}));
    return mawDocuments
}

function makeDocumentFromFile(item: Input) {
    const {filePath, id, book, page, notmusic, titlepage} = item;

    const parts = id.split("_");
    const library = parts[0];

    try {
        const pageData = parseMei(filePath);
        const intervals = pageToContourList(pageData)

        const data: any = {
            siglum: id,
            id: id,
            library: library,
            book: book,
            page_number: page,
            page_data: JSON.stringify(pageData),
            notes: pageToNoteList(pageData).join(' '),
            intervals: intervals.join(' ')
        };
        if (notmusic) {
            data.notmusic = notmusic;
        }
        if (titlepage) {
            data.titlepage = titlepage;
        }
        return data;
    } catch {
        // Probably means the file isn't there
        //console.log(`error reading file ${filePath}`);
        return undefined;
    }
}


function addMaws(documents: any[]) {
    const input: {[k: string]: string} = {}
    for (const doc of documents) {
        if (doc.intervals) {
            input[doc.siglum] = doc.intervals.split(' ').join('')
        }
    }
    const mawsOutput = get_maws_for_codestrings(input);

    return documents.map(doc => {
        const maws: any = {}
        if (mawsOutput[doc.siglum] !== undefined) {
            maws['maws'] = mawsOutput[doc.siglum].join(' ')
            maws['nummaws'] = mawsOutput[doc.siglum].length;
        } else if (mawsOutput[doc.siglum] !== undefined && doc.intervals) {
            // If there's no maws output, but there is an interval string, an error
            console.error(`missing expected maws output for ${doc.siglum}`);
        }
        return {...doc, ...maws};
    });
}
