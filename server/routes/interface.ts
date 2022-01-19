import fs from "fs";
import express from "express";
import {BASE_IMG_URL, BASE_MEI_URL, ngr_len, SERVER_BASE_ROUTE} from "../server.js";
import {get_codestring} from "../services/search.js";


const router = express.Router();
export default router;


router.get('/', function (req, res) {
    const data = {cache: false, base_route: SERVER_BASE_ROUTE}
    res.render('index', data);
});

router.get('/id_searches', function (req, res) {
    const data = { id_searches: true, base_route: SERVER_BASE_ROUTE };
    res.render('index', data);
});

router.get('/code_searches', function (req, res) {
    const data = { code_searches: true, base_route: SERVER_BASE_ROUTE };
    res.render('index', data);
});

router.get('/compare', async function (req, res) {

    // q for 'query', m for 'match'
    const q_id = req.query.qid?.toString();
    const m_id = req.query.mid?.toString();

    let ngram_length;
    if(req.query.ng_len) {
        ngram_length = req.query.ng_len;
    } else {
        ngram_length = ngr_len;
    }

    if (!q_id || !m_id) { return res.status(400).send('q_id and m_id must be provided!'); }

    // Get page-images for query and match
    const img_ext = '.jpg';
    const base_img_url = BASE_IMG_URL;
    const q_jpg_url = base_img_url + q_id + img_ext;
    const m_jpg_url = base_img_url + m_id + img_ext;


    // Get both MEI files
    const mei_ext = '.mei';
    const base_mei_url = BASE_MEI_URL;
    const q_mei_url = base_mei_url + q_id + mei_ext;
    const m_mei_url = base_mei_url + m_id + mei_ext;
    console.log("q_mei_url: " + q_mei_url);


    const q_diat_str = await get_codestring(q_id)
    const m_diat_str = await get_codestring(m_id)

    if (!q_diat_str) { return res.status(400).send('Could not find melody string for this q_id ' + q_id); }
    if (!m_diat_str) { return res.status(400).send('Could not find melody string for this m_id: ' + m_id); }

    function ngram_string(str: string, n: number): string[] | null {
        // Returns array of ngrams of length n
        if(!str.length) return null;
        const ngrams = [];
        if(str.length < n) {
            ngrams.push(str + "%");
        }
        else if (str.length === n) {
            ngrams.push(str);
        } else {
            for(let i = 0; i + n <= str.length; i++) {
                ngrams.push(str.substr(i, n));
            }
        }
        return ngrams;
    }
    function exists(search: number, arr: string[]): boolean {
        return arr.some(row => row.includes(search.toString()));
    }

    function allIndexOf(str: string, findThis: string) {
        const indices = [];
        for(let pos = str.indexOf(findThis); pos !== -1; pos = str.indexOf(findThis, pos + 1)) {
            indices.push(pos);
        }
        return indices;
    }

    function ngrams_in_common(q_str: string, m_str: string, n: number, query: boolean) {
        // Records all locations of each ngram common to query and match
        let q_com_ng_loc: any[] = [];
        let m_com_ng_loc: any[] = [];
        let q_ngrams = ngram_string(q_str, n);
        let m_ngrams = ngram_string(m_str, n);
        if (q_ngrams === null || m_ngrams === null) {
            return []
        }
        let mlocs = [];
        let qlocs = [];
        for (let i = 0; i <= q_ngrams.length; i++) {
            qlocs = allIndexOf(m_str, q_ngrams[i]);
            for (let j = 0; j <= qlocs.length; j++ ) {
                if (qlocs[j] >= 0) {
                    if (!exists(qlocs[j], q_com_ng_loc)) {
                        if(typeof q_com_ng_loc[i] === "undefined") {
                            q_com_ng_loc[i] = [];
                        }
                        const entry = {q_ind: i, m_ind: qlocs[j]};
                        q_com_ng_loc[i].push(entry);
                    }
                }
            }
        }
        for (let i = 0; i <= m_ngrams.length; i++) {
            mlocs = allIndexOf(q_str, m_ngrams[i]);
            for (let j = 0; j <= mlocs.length; j++ ) {
                if (mlocs[j] >= 0) {
                    if (!exists(mlocs[j], m_com_ng_loc)) {
                        if (typeof m_com_ng_loc[i] === "undefined") {
                            m_com_ng_loc[i] = [];
                        }
                        const entry = {
                            m_ind: i,
                            q_ind: mlocs[j]
                        };
                        m_com_ng_loc[i].push(entry);
                    }
                }
            }
        }

        if(query) return q_com_ng_loc.filter(Boolean); //remove null entries
        else return m_com_ng_loc.filter(Boolean); //remove null entries
    }

    // const q_comm = ngrams_in_common(q_diat_str, m_diat_str, ngram_length, true);
    // const m_comm = ngrams_in_common(q_diat_str, m_diat_str, ngram_length, false);

    // const sorted_q_comm = q_comm.sort(function(a, b){return a[0].q_ind - b[0].q_ind});
    // const sorted_m_comm = m_comm.sort(function(a, b){return a[0].m_ind - b[0].m_ind});

    // TODO(ra) probably expose this in the frontend like this...
    // const show_top_ngrams = req.body.show_top_ngrams;
    // const show_top_ngrams = true;
    // const show_top_ngrams = false;
    // const [q_index_to_colour, m_index_to_colour] = generate_index_to_colour_maps(q_diat_str, m_diat_str, show_top_ngrams);

    let q_mei = get_mei(q_mei_url);
    let m_mei = get_mei(m_mei_url);
    if (q_mei === undefined) {
        return res.status(400).send(`Cannot find q_mei_url ${q_mei_url}`)
    }
    if (m_mei === undefined) {
        return res.status(400).send(`Cannot find m_mei_url ${m_mei_url}`)
    }

    const  data = {
        q_id,
        m_id,
        q_jpg_url,
        m_jpg_url,
        q_mei: q_mei.replace(/(\r\n|\n|\r)/gm, ''), // strip newlines
        m_mei: m_mei.replace(/(\r\n|\n|\r)/gm, ''), // strip newlines
        q_diat_str: JSON.stringify(q_diat_str),
        m_diat_str: JSON.stringify(m_diat_str),
        ng_len: ngram_length,
    };
    res.render('compare', data);
});

function get_mei(file: string) {
    // console.log("Getting MEI from: "+ file)
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}