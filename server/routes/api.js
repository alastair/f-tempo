import express from 'express';
import fs from 'fs';
import path from "path";
import {EMO_IDS, tp_jpgs} from "../server.js";
import {get_codestring, parse_id, run_image_query, search_by_codestring, search_by_id} from "../services/search.js";

const router = express.Router();

// Returns an array of all emo ids
router.get('/api/emo_ids', function (req, res) {
    res.send(EMO_IDS);
});

// Returns a random id from the database
router.get('/api/random_id', function (req, res) {
    res.send(EMO_IDS[Math.floor(Math.random() * EMO_IDS.length)]);
});

// Returns a new id (next/previous page/book) in response to that in the request
router.get('/api/next_id', function (req, res) {
// NB FIXME!! This does not work properly with F-Pn IDs, as the 'book' part of the ID is scrambled!
    let next = true; // default to finding next ...
    let page = true; // page
    if (req.query.next !== "undefined") {
        if (req.query.next === "true") next = true;
        else if (req.query.next === "false") next = false;
    }
    if (req.query.page !== "undefined") {
        if (req.query.page === "true") page = true;
        else if (req.query.page === "false") page = false;
    }
    let start_id = req.query.id;
    let new_id = "";
    //console.log("next is "+next);
    let found = EMO_IDS.indexOf(start_id);
    if (found === -1) res.send("ID " + start_id + " not found!");
    //console.log("found = "+found)

    if (page === true) {
        // finding adjacent ID/page
        if (next === true) {
            found += 1;
        } else found -= 1;
        //console.log("new found = "+found);
        // TODO handle end and beginning of EMO_IDS properly!! Maybe as simple as ...
        if ((found >= EMO_IDS.length) || (found < 0)) res.send(start_id);
        new_id = EMO_IDS[found];
        //console.log("ID: "+start_id+" new ID: "+new_id+" ("+next+")");
    } else {
        let parsed_id = parse_id(start_id);
        let this_book = parsed_id.book;
        // find next book
        // console.log("Found this_book: "+this_book)
        let new_id = "";
        let new_book = "";
        if (next === true) {
            for (let i = found; i < EMO_IDS.length; i++) {
                new_id = EMO_IDS[i];
                new_book = parse_id(new_id).book;
                if (new_book !== this_book) {
                    break;
                }
            }
        } else {
            // find previous book]
            for (let i = found; i > 0; i--) {
                new_id = EMO_IDS[i].trim();
                new_book = parse_id(new_id).book;
                if (new_book !== this_book) {
                    // now we are at the last image of the previous book
                    // so find the book before that one and go to next
                    // image - it will be the first of the book we want
                    this_book = new_book;
                    for (; i > 0; i--) {
                        new_id = EMO_IDS[i].trim();
                        new_book = parse_id(new_id).book;
                        if (new_book !== this_book) {
                            if (i > 0) i++; // Don't go to next if at first book
                            new_id = EMO_IDS[i].trim();
                            break;
                        }
                    }
                    break;
                }
            }
        // console.log("Found previous book: "+new_book)
        }
    }

    res.send(new_id);
});

// Returns an array of all title-page jpg urls
router.get('/api/title-pages', function (req, res) {
    res.send(tp_jpgs);
});


router.get('/api/get_codestring', async function (req, res) {
    const id = req.query.id;
    if (typeof id === undefined) {
        return false;
    }
    const searchResult = await get_codestring(id);
    res.send(JSON.stringify(searchResult));
});


/**
 * Perform a search
 *
 *
 * POST a json document with content-type application/json with the following structure
 * { id: if set, perform a search using the document with this siglum
 *   codestring: if set, perform a search with this codestring
 *   jaccard: if true, rank results with jaccard distance, otherwise by number of matching words
 *   threshold:
 *   }
 */
router.post('/api/query', async function (req, res) {
    if (req.body === undefined) {
        return res.status(400).send("requires a body");
    }

    // Defaults
    let num_results = 20;
    let jaccard = true;
    let threshold = false;

    // Set values if given in query
    if (req.body.jaccard !== undefined) {
        jaccard = req.body.jaccard;
    }
    if (req.body.num_results !== undefined) {
        num_results = req.body.num_results;
    }
    if (req.body.threshold !== undefined) {
        threshold = req.body.threshold;
    }

    let result = {};
    if (req.body.id) {
        result = await search_by_id(req.body.id, jaccard, num_results, threshold);
    } else if (req.body.codestring) {
        console.log("codestring is: " + req.body.codestring);
        result = await search_by_codestring(req.body.codestring, jaccard, num_results, threshold);
    }
    return res.send(result);
});


// Handle image uploads
router.post('/api/image_query', function (req, res) {
    if (!req.files) {
        return res.status(400).send('No files were uploaded.');
    }

    // this needs to stay in sync with the name given to the FormData object in the front end
    let user_image = req.files.user_image_file;
    const user_id = req.body.user_id;
    const new_filename = user_image.name.replace(/ /g, '_');

    // TODO: this probably breaks silently if the user uploads two files with the
    // same name -- they'll end up in the working directory, which may cause
    // problems for Aruspix

    const working_path = fs.mkdtempSync(path.join('./run', 'user_id', 'imageUpload-'));

    // Use the mv() method to save the file there
    user_image.mv(working_path + new_filename, (err) => {
        if (err) {
            return res.status(500).send(err);
        } else {
            // console.log("Uploaded file saved as " + working_path + new_filename);
            const ngram_search = false; // TODO(ra): make this work!
            const result = run_image_query(user_id, new_filename, working_path, ngram_search);
            if (result) {
                res.send(result);
            } else {
                return res.status(422).send('Could not process this file.');
            }
        }
    });
});

router.post('/api/log', function (req, res) {
    const log_entry = req.body.log_entry;
    const log = req.body.log;
    if (!log_entry) {
        return res.status(400).send('No report was provided.');
    }
    if (!log) {
        return res.status(400).send('No log was specified.');
    }

    fs.appendFileSync('./logs/' + log, log_entry);

    res.send(
        `Successfully logged:
    ${log_entry}
to log ${log}.`
    );
});

export default router;