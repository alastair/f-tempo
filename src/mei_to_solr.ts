import yargs from 'yargs'
import {listToNgrams, notesToContour, pageToContourList, pageToNoteList, parseMei} from "./mei.js";
import util from 'util';
import solr from "solr-client";
import path from "path";
import fs from "fs";

async function saveToSolr(documents: any[]) {
    return new Promise((resolve, reject)=> {
        const client = solr.createClient({host: "localhost", port: 8983, core: 'ngrams'});
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
    const client = solr.createClient({host: "localhost", port: 8983, core: 'ngrams'});
    client.deleteAll( {}, function (err: any, obj: any) {
        if (err) {
            console.error(err);
        } else {
            console.log(obj);
            client.commit();
        }
    });
}

function     idToParts(documentId: string) {
    const parts = documentId.split("_");
    const library = parts[0];
    let book = undefined;
    let page = undefined;
    if (library === "GB-Lbl") {
        if (parts.length === 4) {
            book = parts[1];
            page = parts[2] + "_" + parts[3];
        } else if (parts.length === 5) {
            book = parts[1] + "_" + parts[2];
            page = parts[3] + "_" + parts[4];
        } else if (parts.length === 6) {
            // GB-Lbl_Rore_Madrigals_Bk3_1560_179
            book = parts[1] + "_" + parts[2] + "_" + parts[3] + "_" + parts[4];
            page = parts[5];
        } else if (parts.length === 7) {
            // GB-Lbl_Rore_Madrigali_Cromatici_Bk1_1563_121
            book = parts[1] + "_" + parts[2] + "_" + parts[3] + "_" + parts[4] + "_" + parts[5];
            page = parts[6];
        }
    }
    return {library, book, page};
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
            }
        })
    })
    .argv;

function makeDocumentFromFile(filePath: string) {
    const meiPage = parseMei(filePath);
    const id = path.basename(filePath, '.mei');

    const {library, book, page} = idToParts(id);
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
        const solrDocument = makeDocumentFromFile(argv.path!);
        //console.log(pprint(solrDocument));
        await saveToSolr([solrDocument]);
    } else if (argv.dir) {
        const files = fs.readdirSync(argv.dir);
        let documents = [];
        for (let i = 0; i < files.length; i++) {
            documents.push(makeDocumentFromFile(path.join(argv.dir, files[i])));
            if (documents.length >= 1000) {
                await saveToSolr(documents);
                documents = [];
            }
        }
    } else {
        yargs.showHelp();
    }
    console.debug("got some args ", argv);
}



function pprint(obj: any): string {
    return util.inspect(obj, false, 4, true);
}