import express from 'express';
import fs from 'fs';
import path from "path";
import {tp_jpgs, db, db_id_to_book} from "../server.js";
import {
    get_codestring,
    get_random_id,
    run_image_query,
    search_by_codestring,
    search_by_id,
    search_by_ngram
} from "../services/search.js";
import fileUpload from "express-fileupload";

const router = express.Router();

// Returns a random id from the database
router.get('/api/random_id', async function(req, res) {
    try {
        const id = await get_random_id();
        const book = db_id_to_book[id as string];
        return res.status(200).json({id, ...book});
    } catch (err) {
        return res.status(500).send("Unable to contact random server");
    }
});

// Returns a new id (next/previous page/book) in response to that in the request
/**
Find the next book id or page id for the provided arguments.
 Required GET arguments:
   - library
   - book
   - page [optional]
   - direction 'next' or 'prev', default next if not set.
 If the `page` argument isn't provided, give the
 */
router.get('/api/next_id', function (req, res) {
    const page_full_id = req.query.id as string;
    const library = req.query.library as string;
    const book_id = req.query.book as string;
    const page_id = req.query.page as string;
    const valid_directions = ["next", "prev"];
    const direction = req.query.direction as string || "next";

    if (!valid_directions.includes(direction)) {
        return res.status(400).json({error: "Invalid `direction` field"});
    }

    if (!page_full_id) {
        return res.status(400).json({error: "No `id` field provided"});
    }
    if (!library) {
        return res.status(400).json({error: "No `library` field provided"});
    }
    if (!book_id) {
        return res.status(400).json({error: "No `book` field provided"});
    }

    const db_library = db[library];
    if (!db_library) {
        return res.status(400).json({error: `Library ${library} not found`});
    }

    if (!db_library.book_ids.includes(book_id)) {
        return res.status(400).json({error: `Book ${book_id} not found in library ${library}`});
    }

    if (page_id) {
        // If a page is set, then we want next/prev page
        const book = db_library.books[book_id];
        if (!book.page_ids.includes(page_id)) {
            return res.status(400).json({error: `Page ${page_id} not found in book ${book_id}`});
        }
        const page_position = book.page_ids.indexOf(page_id)
        let new_position = page_position + (direction === "prev" ? -1 : 1);
        if (new_position < 0) {
            new_position = 0;
        } else if (new_position >= book.page_ids.length) {
            new_position = book.page_ids.length - 1;
        }
        const new_book_page_id = book.page_ids[new_position];
        const response = {
            library,
            book_id,
            page: book.pages[new_book_page_id]
        }
        return res.json(response);
    } else {
        // If page isn't set, we want next/prev book
        const book_position = db_library.book_ids.indexOf(book_id);
        let new_position = book_position + (direction === "prev" ? -1 : 1);
        if (new_position < 0) {
            new_position = 0;
        } else if (new_position >= db_library.books.length) {
            new_position = db_library.books.length - 1;
        }
        const new_book_id = db_library.book_ids[new_position];
        const new_book = db_library.books[new_book_id];
        // If we get a new book, we want to return the first page from that book
        const new_book_page_id = new_book.page_ids[0];
        const response = {
            library,
            book_id: new_book_id,
            page: new_book.pages[new_book_page_id]
        }
        return res.json(response);
    }
});

// Returns an array of all title-page jpg urls
router.get('/api/title-pages', function (req, res) {
    res.send(tp_jpgs);
});


router.get('/api/get_codestring', async function (req, res) {
    const id = req.query.id as string;
    if (typeof id === undefined) {
        return false;
    }
    const searchResult = await get_codestring(id);
    res.send(JSON.stringify(searchResult));
});

type NgramSearchResponse = {
    id: string
    library: string
    book: string
    pageNumber: string
    note_ngrams: string
    pitch_ngrams: string
    page: string[]
}

type NgramResponseNote = {
    p: string
    o: string
    id: string
    x: string
}

type NgramResponseSystem = {
    id: string
    notes: NgramResponseNote[]
}

type NgramResponsePage = {
    width: string
    height: string
    systems: NgramResponseSystem[]
}

/**
 * The same as String.prototype.indexOf, but works on arrays instead of strings
 * @param arr the array to search
 * @param subarr the subarray to find
 * @param startat the starting position in arr to search
 */
function findSubarray(arr: string[], subarr: string[], startat: number) {
    // TODO: This could be updated to use something like KMP to be faster
    for (let i = startat; i < 1 + (arr.length - subarr.length); i++) {
        let j = 0;
        for (; j < subarr.length; j++) {
            if (arr[i + j] !== subarr[j]) {
                break;
            }
        }
        if (j === subarr.length) {
            return i;
        }
    }
    return -1;
}

/**
 * Perform an ngram search
 * POST a json document with content-type application/json with the following structure
 * {ngrams: a list of ngrams to search}
 */
router.post('/api/ngram', async function (req, res) {
    if (req.body === undefined) {
        return res.status(400).send("requires a body");
    }

    let num_results = 20;
    let threshold = 0;
    if (req.body.num_results !== undefined) {
        num_results = req.body.num_results;
    }
    if (req.body.threshold !== undefined) {
        threshold = parseInt(req.body.threshold, 10);
    }

    const ngrams = req.body.ngrams;
    const interval = req.body.interval;
    const search_ngrams_arr = ngrams.split(" ");
    // Convert ngrams from a space separated string to an array
    if (search_ngrams_arr.length) {
        const result = await search_by_ngram(ngrams, num_results, threshold, interval);
        const response = result.map((item: NgramSearchResponse) => {
            // Find the start position(s) of the search term in the results
            const positions: number[] = [];
            // console.debug(`len note ngrams: ${item.note_ngrams.split(" ").length}`)
            const note_ngrams_arr = interval ? item.pitch_ngrams.split(" ") : item.note_ngrams.split(" ");
            let position = findSubarray(note_ngrams_arr, search_ngrams_arr, 0)
            while (position !== -1) {
                positions.push(position);
                position = findSubarray(note_ngrams_arr, search_ngrams_arr, position + ngrams.length);
            }
            // console.debug(`positions: ${positions}`);
            const pageDocument: NgramResponsePage = JSON.parse(item.page[0]);
            // Unwind the page/systems/notes structure to a flat array so that we can apply the above positions
            const notes: any[] = [];
            for (const system of pageDocument.systems) {
                for (const note of system.notes) {
                    notes.push({note: `${note.p}${note.o}`, id: note.id, system: system.id})
                }
            }
            // console.debug(`len unwound notes: ${notes.length}`)
            const responseNotes = positions.map((start) => {
                // If it's an interval search select 1 more note because we're working with gaps instead of notes
                const len = search_ngrams_arr.length + (interval ? 1 : 0);
                return notes.slice(start, start + len);
            });
            return {match_id: item.id, notes: responseNotes};
        });
        return res.json(response)
    } else {
        return res.status(400).json({error: "No ngrams set"})
    }
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
    let threshold = 0;
    let collections_to_search = [];

    // Set values if given in query
    if (req.body.jaccard !== undefined) {
        jaccard = req.body.jaccard;
    }
    if (req.body.num_results !== undefined) {
        num_results = req.body.num_results;
    }
    if (req.body.threshold !== undefined) {
        threshold = parseInt(req.body.threshold, 10);
    }
    if (req.body.collections_to_search !== undefined) {
        collections_to_search = req.body.collections_to_search;
    }

    let result: any[] = [];
    try {
        if (req.body.id) {
            result = await search_by_id(req.body.id, collections_to_search, jaccard, num_results, threshold);
        } else if (req.body.codestring) {
            console.log("codestring is: " + req.body.codestring);
            result = await search_by_codestring(req.body.codestring, collections_to_search, jaccard, num_results, threshold);
        }
        result = result.map((r) => {
            const id = r.id;
            const book = db_id_to_book[id];
            return {...r, ...book}
        })
        return res.send(result);
    } catch (err) {
        console.error(err);
        console.trace();
        return res.status(500).send("Unable to contact search server");
    }
});


// Handle image uploads
router.post('/api/image_query', function (req, res) {
    if (!req.files) {
        return res.status(400).send('No files were uploaded.');
    }

    // this needs to stay in sync with the name given to the FormData object in the front end
    let user_image = req.files.user_image_file as fileUpload.UploadedFile;
    const new_filename = user_image.name.replace(/ /g, '_');

    // TODO: this probably breaks silently if the user uploads two files with the
    // same name -- they'll end up in the working directory, which may cause
    // problems for Aruspix

    const working_path = fs.mkdtempSync(path.join('./run', 'user_id', 'imageUpload-'));

    // Use the mv() method to save the file there
    user_image.mv(working_path + new_filename, (err: any) => {
        if (err) {
            return res.status(500).send(err);
        } else {
            // console.log("Uploaded file saved as " + working_path + new_filename);
            const ngram_search = false; // TODO(ra): make this work!
            const result = run_image_query(new_filename, working_path, ngram_search);
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

    try {
        fs.appendFileSync('./logs/' + log, log_entry);
        return res.send(
            `Successfully logged:
    ${log_entry}
to log ${log}.`
        );
    } catch (err) {
        return res.status(500).send("Cannot write log file");
    }


});

export default router;