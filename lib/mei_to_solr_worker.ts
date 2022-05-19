/// <reference types="./types" />
import { get_maws_for_codestrings } from './maw.js';
import {pageToContourList, pageToNoteList, parseMeiFile, parseMeiParts} from "./mei.js";
import nconf from 'nconf';
import workerpool from 'workerpool';

nconf.argv().file('./config/default_config.json')
if (process.env.NODE_ENV === "production") {
    nconf.file('./config/production_config.json')
}

const meiRoot = nconf.get('config:base_mei_url');

// Only bind the pool if we have >1 threads
if (nconf.get('config:import:threads') !== 1) {
    workerpool.worker({
        doImport: doImport
    });
}

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

export function doImport(param: Input[]) {
    const documents = param.flatMap(item => {
        return makeDocumentsFromFile(item);
    })
    const mawDocuments = addMaws(documents.filter(d => {return d !== undefined}));
    return mawDocuments
}

function makeDocumentsFromFile(item: Input) {
    const {filePath, id, book, page, notmusic, titlepage, type} = item;

    const parts = id.split("_");
    const library = parts[0];

    const pageDataToSolr = (pageData: Page) => {
        const intervals = pageToContourList(pageData)

        // We use this label when running the maws binary, and it can only accept letters/numbers
        const label = pageData.label ? `_${pageData.label.replaceAll(/[^A-Za-z-_]/g, '_')}` : '';
        // TODO: Type for this
        const data: any = {
            part_number: pageData.partNumber,
            part_name: pageData.label,
            mei_path: pageData.meiPath,
            siglum: id + label,
            id: id + label,
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
    }

    try {
        if (type === 'aruspix') {
            // Aruspix files have just 1 part, so return it as a list
            const pageData = parseMeiFile(meiRoot, filePath);
            return [pageDataToSolr(pageData)];
        } else if (type === 'mxml') {
            // Files from CPDL/musicxml may have multiple parts, so return each of them
            const pageParts = parseMeiParts(meiRoot, filePath);
            return pageParts.map((pagePart) => {
                return pageDataToSolr(pagePart);
            });
        }
    } catch (e) {
        // Probably means the file isn't there
        //console.log(`error reading file ${filePath}`);
        throw e;
        return [undefined];
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
