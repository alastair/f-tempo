//Cosine similarity code (from: 
// https://medium.com/@sumn2u/string-similarity-comparision-in-js-with-examples-4bae35f13968)
//(function () {

function termFreqMap(str) {
    var words = str.split(' ');
    var termFreq = {};
    words.forEach(function (w) {
        termFreq[w] = (termFreq[w] || 0) + 1;
    });
    return termFreq;
}

function addKeysToDict(map, dict) {
    for (var key in map) {
        dict[key] = true;
    }
}

function termFreqMapToVector(map, dict) {
    var termFreqVector = [];
    for (var term in dict) {
        termFreqVector.push(map[term] || 0);
    }
    return termFreqVector;
}

function vecDotProduct(vecA, vecB) {
    var product = 0;
    for (var i = 0; i < vecA.length; i++) {
        product += vecA[i] * vecB[i];
    }
    return product;
}

function vecMagnitude(vec) {
    var sum = 0;
    for (var i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}

function cosineSimilarity(vecA, vecB) {
    return vecDotProduct(vecA, vecB) / (vecMagnitude(vecA) * vecMagnitude(vecB));
}

//  Cosinesimilarity =
function textCosineSimilarity(strA, strB) {
    var termFreqA = termFreqMap(strA);
    var termFreqB = termFreqMap(strB);

    var dict = {};
    addKeysToDict(termFreqA, dict);
    addKeysToDict(termFreqB, dict);

    var termFreqVecA = termFreqMapToVector(termFreqA, dict);
    var termFreqVecB = termFreqMapToVector(termFreqB, dict);

    return cosineSimilarity(termFreqVecA, termFreqVecB);
}

//})();
// End of cosine similarity code

// Global variables
var collections_to_search = [];

let num_results = 15; // default
let query_id = "";
let db_name = "";
let highlighted_result_row = 0;
let jaccard = true;
let corpus_search_mode = true; // false when image search mode
let matched_words = []; // Arrays for displaying match stats in result list
let words_in_page = []; // ''
let user_id; // for identifying user to logs, etc.
let can_store_user_id = false;

let tp_urls = get_tp_urls(); // Array of title-page urls loaded at startup

let current_page = {library: '', book: '', page: ''};

var ports_to_search = [];

const BASE_IMG_URL = 'https://uk-dev-ftempo.rism.digital/img/jpg/';

function get_or_set_user_id() {
    if (storageAvailable('localStorage')) {
        // console.log("Local Storage available!")
        user_id = localStorage.getItem("userID");
        can_store_user_id = true;

        if (!user_id) {
            console.log("Setting new user_id!");
            user_id = uniqueID();
            localStorage.setItem("userID", user_id);
        }
    } else {
        console.log("No Local Storage available! Setting new temporary user_id");
        user_id = uniqueID();
    }
    // console.log("user_id is " + user_id);
}

function load_page_query(id) {
    clear_result_divs();

    document.getElementById("query_id").value = id;
    let image = id + ".jpg";
    document.getElementById("q_page_display").innerHTML = "Query page: " + id;
    document.getElementById("emo_image_display").style.maxWidth = "700px";
    let emo_im_disp_width = '100%';
    document.getElementById("emo_image_display").innerHTML = "<img id='query_image' src='" + BASE_IMG_URL + image + "' width=" + emo_im_disp_width + " role=\"presentation\"/>";
    $('#emo_image_display').zoom();
}

function reload_page_query(id) {
    document.getElementById("query_id").value = id;
    let image = id + ".jpg";
    document.getElementById("emo_image_display").style.maxWidth = "700px";
    document.getElementById("emo_image_display").innerHTML = "<img id='query_image' src='" + BASE_IMG_URL + image + "' role=\"presentation\"/>";
    $('#emo_image_display').zoom();
}

const ngr_len = 5;

// Canvas needs to be created and supplied!
function lineAt(canvas, startx, starty, colour) {
    let h = canvas.height;
    let ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(startx, starty);
    ctx.lineTo(startx, starty + h);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.stroke();
}

function display_cosine_sim_line(json) {
    var results = json;
    var q_str = results[0].codestring;
    for (let q = 1; q < num_results; q++) {
        let progID = 'progress' + q;
        let progRect = document.getElementById(progID).getBoundingClientRect();
        let canWidth = progRect.width;
        let canHeight = progRect.height;
        let canTop = progRect.top;
        let canLeft = progRect.left;
        let canID = 'canvas' + q;
        let canv = document.createElement('canvas');
        canv.id = canID;
        document.getElementById(progID).parentNode.appendChild(canv);
        canv.style.position = "absolute";
        canv.style.zIndex = "2";
        canv.width = canWidth;
        canv.height = "5";
        canv.top = (canTop - canHeight) + "px";
        canv.left = canLeft;
        const m_str = results[q].codestring;
        var cos_sim = textCosineSimilarity(ngram_array(q_str, ngr_len).join(' '), ngram_array(m_str, ngr_len).join(' '));
        var line_x = cos_sim * canv.width;
        lineAt(canv, line_x, 0, "red");
    }
}

// Basic remote search function.
function search(id, jaccard, num_results, collections_to_search, record) {
    let search_data = JSON.stringify({id, jaccard, num_results, threshold, collections_to_search});
    console.log(search_data);
    if (record) {
        searches.push({search_data: JSON.parse(search_data)});
    }
    $('#results_table').html('<tr><td><img src="img/ajax-loader.gif" alt="search in progress"></td></tr>');
    $.ajax({
        url: 'api/query',
        method: 'POST',
        data: search_data,
        contentType: 'application/json',
    })
        .done(show_results)
        .fail((xhr, status) => alert(status)); // TODO: real error handling!
}

// Users may wish to revisit recent searches.
// Globals 'searches' array stores the search-data for recent searches; it 
// will die when page is restarted
var searches = [];

function repeat_search(n) {
    document.getElementById("emo_image_display").innerHTML = "";
    document.getElementById("q_page_display").innerHTML = "";
    const id = searches[n].search_data.id;
    load_page_query(id);
    search(
        searches[n].search_data.id,
        searches[n].search_data.jaccard,
        searches[n].search_data.num_results,
        searches[n].search_data.collections_to_search,
        false // don't record this as a new search!
    );
}

function code_search(codestring, jaccard, num_results, collections_to_search, record) {
    $('#results_table').html('<tr><td><img src="img/ajax-loader.gif" alt="search in progress"></td></tr>');
    let search_data = JSON.stringify({codestring, jaccard, num_results, threshold, collections_to_search});
    if (record) {
        searches.push({search_data: JSON.parse(search_data)});
    }
    $.ajax({
        url: 'api/query',
        method: 'POST',
        data: search_data,
        contentType: 'application/json',
    })
        .done(show_results)
        .fail((xhr, status) => alert(status)); // TODO: real error handling!
}


function search_by_active_query_id(load_query_image = false, ngram_search, collections_to_search) {
    $('#results_table').html('<tr><td><img src="img/ajax-loader.gif" alt="search in progress"></td></tr>');
    query_id = document.getElementById("query_id").value;
    if (load_query_image) {
        load_page_query(query_id);
    }
    update_colls_to_search();
    search(query_id, jaccard, num_results, ngram_search, collections_to_search, true);
}

function show_tp(id, isquery) {
    let new_img_src = "";
    for (var i = 0; i < tp_urls.length; i++) {
        if (tp_urls[i].indexOf(parse_id(id).book) > 0) {
            // get small version of the image via IIIF:
            let bits = tp_urls[i].split("/");
            for (var j = 0; j < bits.length - 1; j++) {
                var seg = bits[j];
                if (seg == ",500") seg = "500,";
                new_img_src += seg + "/";
            }
            new_img_src += bits[j];
            break;
        }
    }
    if (isquery) {
        var query_tp_img = document.getElementById("query_image");
        query_tp_img.src = new_img_src;
        query_tp_img.style.height = 'min(500px, calc(50vh - 100px))';
        query_tp_img.style.left = "20";
        $('#emo_image_display').zoom({url: query_tp_img.src});
    } else {
        var result_tp_img = document.getElementById("result_image");
        result_tp_img.src = new_img_src;
        result_tp_img.style.height = 'min(500px, calc(50vh - 100px))';
        result_tp_img.style.right = "20";
        $('#result_image_display').zoom({url: result_tp_img.src});
    }
}

function preloadImages(srcs) {
    if (!preloadImages.cache) {
        preloadImages.cache = [];
    }
    var img;
    // leave out srcs[0] as it's the query, and already loaded
    for (var i = 1; i < srcs.length; i++) {
        img = new Image();
        img.src = srcs[i];
        preloadImages.cache.push(img);
    }
}

var imageSrcs = [];

function show_results(json) {
    imageSrcs.length = 0; // empty the cache altogether
    var results = json;
    const provide_judgements = $('#provide_judgements').is(':checked');

    if (json.length < 2) {
        console.log("No results for " + query_id + "!");
        document.getElementById("result_id_msg").innerHTML = "<font color='red'>No results!!</font>";
        return false;
    }

    num_results = results.length;

    let table_html = "<thead><tr><th colspan=3>" + num_results + " results - "
        + results[0].num_words + " words in query</th></tr>"
        + "<tr><th>Page ID</th>"
        + "<th>Match Score</th>";
    if (provide_judgements) {
        table_html += "<th>Judge Match</th>";
    }
    table_html += "</tr></thead>"
        + "<tbody class='table_body'>";

    for (let q = 0; q < results.length; q++) {
        let rank_factor;

        // NOTE: the else here is wrong if we don't assume that the
        // 0th result is the identity match
        if (jaccard) {
            rank_factor = 1 - results[q].jaccard;
        } else {
            rank_factor = results[q].num_matched_words / results[0].num_words;
        }

        matched_words[q] = results[q].num_matched_words;
        words_in_page[q] = results[q].num_words;
        var result_row_id = "result_row" + q;
        var target_id = results[q].id;
        var sim_choice_id = "sim_choice" + q;
        var sim_id = "sim" + q;
        imageSrcs.push(BASE_IMG_URL + results[q].id + ".jpg");

        const rank_percentage = (rank_factor * 100).toFixed(2);

        if (corpus_search_mode && results[q].id === query_id) { // query
            table_html +=
                "<tr class='id_list_name' id='" + result_row_id
                + "' onclick='load_result_image(\"" + target_id + "\"," + q + "," + (rank_factor * 100).toFixed(1) + ");'>";
            if (target_id.startsWith("D-Mbs")) {
                table_html += "<td id='title_page_link'><img src='img/tp_book.svg' height='20' onmousedown='show_tp(\"" + query_id + "\"," + true + ")' onmouseup='reload_page_query(\"" + query_id + "\")'></td>";
            } else {
                table_html += "<td></td>";
            }
            table_html += "<td text-align='center' style='color:blue; font-size: 10px'>" + target_id + "</td>";
            table_html += "<td>"
                + '<div class="progress" width="15%">'
                + '<div class="progress-bar" role="progressbar" style="width: ' + rank_percentage + '%;" aria-valuenow="' + rank_percentage + '" aria-valuemin="0" aria-valuemax="100">' + rank_percentage + '</div>'
                + "</td>";
            +"</div>";
            table_html += "<td></td>";// empty cell here
            if (provide_judgements) {
                table_html += "<td id='" + sim_choice_id + "'>"
                    + "<select class='drop_downs'"
                    + "onchange='log_user_choice(\"" + query_id + "\",\""
                    + target_id + "\","
                    + q + ", \""
                    + db_name + "\");'"
                    + " id='" + sim_id + "'>"
                    + "<option selected' value='0'></option>"
                    + "<option value='notm'>Not music!</option>"
                    + "</select>"
                    + "</td>";
            }
            table_html += "</tr>";

        } else {  // results
            table_html +=
                "<tr class='id_list_name' id='" + result_row_id
                + "' onclick='load_result_image(\"" + target_id + "\"," + q + "," + (rank_factor * 100).toFixed(1) + ");'>";
            if (target_id.startsWith("D-Mbs")) table_html += "<td id='title_page_link'><img src='img/tp_book.svg' height='20' onmousedown='show_tp(\"" + target_id + "\"," + false + ")'></td>";
            else table_html += "<td></td>";
            table_html += "<td text-align='center' style='color:blue; font-size: 10px'>" + target_id + "</td>"
                + "<td >"
                + '<div class="progress" id="progress' + q + '" width="15%">'
                + '<div class="progress-bar" role="progressbar" style="width: ' + rank_percentage + '%;" aria-valuenow="' + rank_percentage + '" aria-valuemin="0" aria-valuemax="100">' + rank_percentage + '</div>'
                + "</td>"
                + "<td><img class='mag-glass' width='16' height='16' src='img/magnifying-glass.svg' onclick='compare(\"" + query_id + "\",\"" + results[q].id + "\")'/></td>";
            if (provide_judgements) {
                table_html += "<td id='" + sim_choice_id + "'>"
                    + "<select  class='drop_downs'"
                    + " onchange='log_user_choice(\"" + query_id + "\",\""
                    + target_id + "\","
                    + q + ", "
                    + "\"" + db_name + "\");'"
                    + " id='" + sim_id + "'>"
                    + "<option selected' value='0'></option>"
                    + "<option value='dupl'>Duplicate page</option>"
                    + "<option value='same'>Same music</option>"
                    + "<option value='relv'>Related music</option>"
                    + "<option value='notm'>Not music!</option>"
                    + "</select>"
                    + "</td>";
            }
            table_html += "</tr>";
        }
    }
    preloadImages(imageSrcs);
    table_html += "</tbody>";

    $('#results_table').html(table_html);

    const top_result_id = results[0].id;
    let top_result_rank_factor;
    if (jaccard) {
        top_result_rank_factor = 1 - results[0].jaccard;
    } else {
        top_result_rank_factor = results[0].num_matched_words / results[0].num_words;
    }

    load_result_image(top_result_id, 0, top_result_rank_factor);

    if (query_id.length) {
        display_cosine_sim_line(json);
    }
}


function compare(a, b) {
    var url = "compare?qid=" + a + "&mid=" + b;
    window.open(url, "_blank",
        'width=1200, \
         height=600, \
         directories=no, \
         location=no, \
         menubar=no, \
         resizable=no, \
         scrollbars=1, \
         status=no, \
         toolbar=no');
}

function highlight_result_row(rank) {
    let rowID;
    for (var i = 0; i < parseInt(document.getElementById("res_disp_select").value); i++) {
        rowID = "result_row" + i;
        if (document.getElementById(rowID).style != null) {
            document.getElementById(rowID).style.backgroundColor = "White";
        }
    }
    rowID = "result_row" + rank;
    document.getElementById(rowID).style.backgroundColor = "LightPink";
    highlighted_result_row = rank;
}

function load_result_image(id, rank, percent) {
    if (!id) {
        document.getElementById("result_id_msg").innerHTML = "";
        document.getElementById("result_image_display").innerHTML = "";
        return false;
    }
    const image = id + ".jpg";

    if (query_id !== id) {
        document.getElementById("result_id_msg").innerHTML =
            matched_words[rank] + "/" + words_in_page[rank] + " words in page match the query";
    } else {
        document.getElementById("result_id_msg").innerHTML = "Query: " + id;
    }

    document.getElementById("result_image_display").style.maxWidth = '700px';
    document.getElementById("result_image_display").innerHTML = "<img id='result_image' width='100%' alt='... image loading!' src='" + BASE_IMG_URL + image + "' />";
    highlight_result_row(rank);
    $('#result_image_display').zoom();
    document.getElementById("query_id").value = id;
}

// Load title-page jpg urls at startup
function get_tp_urls() {
    var result = "";
    $.ajax({
        type: "GET",
        url: "api/title-pages",
        async: false,
        success: function (data) {
            result = data;
        }
    });
    return result;
}

/*********** Utility functions: ***********/
function storageAvailable(type) {
    try {
        var storage = window[type],
            x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === 'QuotaExceededError' ||
                // Firefox
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage.length !== 0;
    }
}

function getFormattedDate() {
    var date = new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    month = (month < 10 ? "0" : "") + month;
    day = (day < 10 ? "0" : "") + day;
    hour = (hour < 10 ? "0" : "") + hour;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;
    var str = date.getFullYear() + "-" + month + "-" + day + "_" + hour + ":" + min + ":" + sec;
    return str;
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// From: https://gist.github.com/gordonbrander/2230317
function uniqueID() {
    function chr4() {
        return Math.random().toString(16).slice(-4);
    }

    return chr4() + chr4() +
        '-' + chr4() +
        '-' + chr4() +
        '-' + chr4() +
        '-' + chr4() + chr4() + chr4();
}

function log_user_choice(query_id, target_id, result_num, database) {
    var the_time = getFormattedDate();
    var sim_id = "sim" + result_num;
    var sim_choice = document.getElementById(sim_id).value;
    var log_entry = the_time + "\t";
    if (can_store_user_id) {
        log_entry += localStorage.getItem("userID");
    } else {
        log_entry += user_id;
    }
    log_entry += "\t"
        + query_id + "\t"
        + target_id + "\t"
        + sim_choice + "\t"
        + database + "\t"
        + 'rank: ' + result_num + ": " + (jaccard ? 'Jaccard distance' : 'Basic')
        + "\n";
    $.ajax({
        type: "POST",
        url: "api/log",
        data: {
            log_entry: log_entry,
            log: 'user_choice.log'
        },
        dataType: 'TEXT',
        success: function (response) {
            console.log(response);
        }
    });
}

// Client-side UI stuff
function checkKey(e) {

    e = e || window.event;
    var shiftDown = e.shiftKey;

    if ([13, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }

    if (e.keyCode === 38 || e.keyCode === 40) {
        // highlighting stuff
        const result_row = "result_row";
        let row_id = "";
        if (e.keyCode === 38) {    // up arrow
            if (highlighted_result_row > 0) {
                row_id = result_row + (highlighted_result_row - 1);
            } else {
                return;
            }
        } else if (e.keyCode === 40) {    // down arrow
            if (highlighted_result_row < num_results - 1) {
                row_id = result_row + (highlighted_result_row + 1);
            } else {
                row_id = "result_row0";
            }
        }
        document.getElementById(row_id).click();
        return;
    }
    if (e.keyCode === 37) {    // left arrow - Search previous page/book
        (shiftDown) ? find_book_id(false) : find_page_id(false);
        query_id = document.getElementById("query_id").value;
    } else if (e.keyCode === 39) {    // right arrow - Search next page/book
        (shiftDown) ? find_book_id(true) : find_page_id(true);
        query_id = document.getElementById("query_id").value;
    } else if (e.keyCode === 220) { // '\' for random query
        find_random_page();
        query_id = document.getElementById("query_id").value;
        load_page_query(query_id);
    } else if (e.keyCode === 13) { // enter to search
        do_search();
    }
}

function update_colls_to_search() {
    collections_to_search.length = 0; // clear the list first
    $('#collection_select_table tr').each(function () {
        $(this).find('td input').each(function () {
            if (this.checked) {
                if (!collections_to_search.includes(this.id.substring(7).replace("_", "-"))) {
                    collections_to_search.push(this.id.substring(7).replace("_", "-"));
                }
            }
        });
    });
    console.log("Searching: " + collections_to_search);
}


function parse_id(id) {
    let parsed_id = {};
    let segment = id.split("_");
    // The library RISM siglum is always the prefix to the id,
    // followed by the first underscore in the id.
    parsed_id.RISM = segment[0];
    switch (parsed_id.RISM) {
        case "D-Mbs":
        case "PL-Wn":
            parsed_id.book = segment[1];
            parsed_id.page = segment[2];
            break;
        case "F-Pn":
        case "GB-Lbl":
            if (segment.length == 4) {
                parsed_id.book = segment[1];
                parsed_id.page = segment[2] + "_" + segment[3];
            } else {
                parsed_id.book = segment[1] + "_" + segment[2];
                parsed_id.page = segment[3] + "_" + segment[4];
            }
            break;
        case "D-Bsb":
            if (segment.length == 6) {
                parsed_id.book = segment[1] + "_" + segment[2] + "_" + segment[3];
                parsed_id.page = segment[4] + "_" + segment[5];
            }
            if (segment.length == 7) {
                parsed_id.book = segment[1] + "_" + segment[2] + "_" + segment[3];
                parsed_id.page = segment[4] + "_" + segment[5] + "_" + segment[6];
            }
    }
    return parsed_id;
}


// Client-side, though this needs to interact with server, as book data will be on server, not client
// Book IDs are always at the beginning of the ID, following the library RISM siglum, which is itself followed by the first underscore char.
// However, their format varies from library to library, so we need to take care of this.

function find_book_id(next) {
    var this_id = document.getElementById("query_id").value.trim();
    if (this_id == null) return false;
    const direction = next ? "next" : "prev";

    let new_id = {};
    $.ajax({
        url: '/api/next_id',
        data: {id: this_id, library: current_page.library, book: current_page.book, direction: direction},
        method: 'GET',
        async: false,
        success: function (response) {
            new_id = response;
        }
    }).fail((xhr, status) => alert(status)); // TODO: real error handling!
    query_id = new_id.page.id;
    current_page = {library: new_id.library, book: new_id.book_id, page: new_id.page.id};
    load_page_query(query_id);
}

function find_page_id(next) {
    var this_id = document.getElementById("query_id").value.trim();
    if (this_id === null) return false;
    const direction = next ? "next" : "prev";

    let new_id = {};
    $.ajax({
        url: '/api/next_id',
        data: {
            id: this_id,
            library: current_page.library,
            book: current_page.book,
            page: current_page.page,
            direction: direction
        },
        method: 'GET',
        async: false,
        success: function (response) {
            new_id = response;
        }
    }).fail((xhr, status) => alert(status)); // TODO: real error handling!
    query_id = new_id.page.id;
    current_page = {library: new_id.library, book: new_id.book_id, page: new_id.page.id};
    load_page_query(query_id);
}

function find_random_page() {
    $.ajax({
        url: '/api/random_id',
        method: 'GET',
        async: false,
        success: function (response) {
            var page = response.id;
            var book = response.book;
            var library = response.library;
            load_page_query(page);
            current_page = {library, book, page};
        }
    })
        .fail((xhr, status) => alert(status)); // TODO: real error handling!
}

function basename(path) {
    return path.replace(/\\/g, '/').replace(/.*\//, '');
}

function clear_result_divs() {
    const result_div_ids = ['results_table', 'result_image_display', 'result_id_msg'];
    for (const id of result_div_ids) {
        $('#' + id).empty();
    }
}


/*******************************************************************************
 * Browsing EMO
 ******************************************************************************/

function show_example(example) {
    load_page_query(example.id);
    current_page = {library: example.library, book: example.book, page: example.id};
    $('#examples_div').collapse('hide');
    do_search();
}

/*******************************************************************************
 * Image upload
 ******************************************************************************/

function validate_file_upload() {
    const files = $('#user_image_file')[0].files;

    if (files.length === 0) {
        alert('Select a file to upload.');
        return;
    } else if (files.length > 1) {
        alert('You can only upload 1 file.');
        return;
    }
    return files[0];
}


function show_user_image(user_image_file) {
    const reader = new FileReader();
    reader.onload = () => {
        const user_image = $('<img>', {
            id: 'user_image',
            class: 'img-fluid',
            src: reader.result
        });
        $('#user_image_display').empty();
        $('#user_image_display').prepend(user_image);
        $('#user_image_display').zoom();
    };
    reader.readAsDataURL(user_image_file);
}


function submit_upload_form(user_image_file) {

    clear_result_divs();

    const formData = new FormData();
    formData.append('user_image_file', user_image_file, user_image_file.name);
    formData.append('user_id', user_id);
    $.ajax({
        url: 'api/image_query',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
    }).done((data) => {
        $('#uploading_status').empty();
        show_results(data);
    }).fail((xhr, status) => {
        $('#uploading_status').empty();
        alert(status);
    });
}

/*******************************************************************************
 * Search settings
 ******************************************************************************/

var threshold = false;
var search_threshold = 0.05; //default
function change_num_res() {
    if (document.getElementById("res_disp_select").value == "Best") {
        threshold = search_threshold;
    } else {
        num_results = document.getElementById("res_disp_select").value;
        threshold = false;
    }
    if (!$('#results_table').is(':empty')) {
        search_by_active_query_id();
    }
}

function change_search_method() {
    const search_select = document.getElementById('search_select');
    const v = search_select.options[search_select.selectedIndex].value;
    if (v == 1) {
        ngram_search = true;
    } else {
        ngram_search = false;
    }
    return ngram_search;
}

function change_ranking_method() {
    const ranking_select = document.getElementById('ranking_select');
    const v = ranking_select.options[ranking_select.selectedIndex].value;
    if (v == 0) {
        jaccard = true;
    } else {
        jaccard = false;
    }
    if (!$('#results_table').is(':empty')) {
        search_by_active_query_id();
    }
}

function set_corpus_search_mode() {
    // console.log('search with corpus');
    clear_result_divs();
    $('#emo_browser_col').removeClass('d-none');
    $('#image_upload_col').addClass('d-none');
    $('#search_controls').removeClass('d-none');
    $('#corpus_search_link').addClass('active');
    $('#image_search_link').removeClass('active');
    $('#code_search_link').removeClass('active');
    $('#examples_container').removeClass('d-none');
    corpus_search_mode = true;
}

function set_image_search_mode() {
    // console.log('search with images!');
    clear_result_divs();
    $('#emo_browser_col').addClass('d-none');
    $('#image_upload_col').removeClass('d-none');
    $('#corpus_search_link').removeClass('active');
    $('#image_search_link').addClass('active');
    $('#code_search_link').removeClass('active');
    $('#search_controls').addClass('d-none');
    $('#examples_container').addClass('d-none');
    corpus_search_mode = false;
}

function do_search() {
    query_id = document.getElementById("query_id").value;
    load_page_query(query_id);
    update_colls_to_search();
    var search_num_results = parseInt(document.getElementById("res_disp_select").value);
    search(query_id, jaccard, search_num_results, collections_to_search, true);
}

/*******************************************************************************
 * Start
 ******************************************************************************/

function add_examples_list() {
    const examples = [
        {library: 'GB-Lbl', book: 'K2h7', id: 'GB-Lbl_K2h7_092_1', desc: "Different editions of Berchem, 'O s'io potessi donna' (<i>Cantus</i>)"},
        {library: 'GB-Lbl', book: 'A360a', id: 'GB-Lbl_A360a_005_0', desc: "Very different editions of Striggio, 'Alma reale' (<i>Canto</i>)"},
        {library: 'GB-Lbl', book: 'K3k19', id: 'GB-Lbl_K3k19_012_1', desc: "Lassus, 'Susanna faire' (<i>Cantus</i>) and the original French chanson"},
        {library: 'GB-Lbl', book: 'K3k19', id: 'GB-Lbl_K3k19_014_0', desc: "Marenzio, 'I must depart all haples' (<i>Cantus</i>), and: (a) the original Italian madrigal; (b) the <i>Quinto</i> part of the latter, split between nos. 13 and 14"},
        {library: 'GB-Lbl', book: 'A324', id: 'GB-Lbl_A324c_048_1', desc: "Nanino, 'Morir non puo'l mio core' (<i>Alto</i>) and the English version (<i>Contratenor</i>) - note the two extra notes at the beginning! There is also a Latin contrafactum at no. 6"},
        {library: 'GB-Lbl', book: 'K3k12', id: 'GB-Lbl_K3k12_010_0',  desc: "Marenzio, 'Sweet hart arise' (<i>Superius</i>), and the English version (<i>Canto</i>); the Italian <i>Quinto</i> part is ranked at 15 - you can increase the number of results using the dropdown."},
        {library: 'GB-Lbl', book: 'K9a10', id: 'GB-Lbl_K9a10_023_0', desc: "Morales, 'Magnificat Sexti toni' (choirbook); ranks 2 & 3 are different voice-parts from the work"},
        {library: 'GB-Lbl', book: 'A19', id: 'GB-Lbl_A19_004_0',    desc: "End of Clemens non Papa, 'Pater peccavi' and beginning of its <i>Secunda pars</i>, 'Quanti mercanarii' (<i>Tenor</i>); 'Pater peccavi' is at rank 2"},
        {library: 'GB-Lbl', book: 'K3e1', id: 'GB-Lbl_K3e1_061_1',  desc: "Clemens non Papa, 'Angelus domini' (<i>Bassus</i>); other editions at ranks 2 to 6, and 9; <i>Tenor</i> part at ranks 7 to 8, and 10; another edition of <i>Bassus</i> at rank 5"},
        {library: 'GB-Lbl', book: 'K2a4', id: 'GB-Lbl_K2a4_072_1',  desc: "Lassus, Psalm 11, 'Pourquoy font bruit' (<i>Contratenor</i>), and the chanson on which it is based, 'Las me faut', ranked at 2; at ranks 3 & 4 are the two pages of another edition of the chanson"},
        {library: 'GB-Lbl', book: 'A569c', id: 'GB-Lbl_A569c_024_0', desc: "Willaert, 'Recercar quinto', was also published in a transposed version  (GB-Lbl_K3b4_013_0) as well as at the original pitch (GB-Lbl_K3b4_020_0)"},
        {library: 'GB-Lbl', book: 'K8f10', id: 'GB-Lbl_K8f10_134_1', desc: "Anonymous <i>lauda</i>, 'Ecco care sorelle' (<i>Cantus</i> and <i>Tenor</i> parts on same page!) is actually a close version of Verdelot, 'Fedel' e bel cagnuolo' (<i>Cantus</i> at rank 2; <i>Tenor</i> at rank 3)"},
        {library: 'GB-Lbl', book: 'A569c', id: 'GB-Lbl_A569c_013_1', desc: "'Recercar undecimo' (<i>Canto</i>), by <i>Incerto Autore</i>; at rank 2 is Damianus, 'In die tribulationis' (scholars disagree about the identity of this composer); <i>Basso</i> part of the recercar at rank 3"},
        {library: 'D-Bsb', book: 'Parangon_03', id: 'D-Bsb_Parangon_03_1543_inv_060_0', desc: "Arcadelt, 'Vous perdez temps' (Tenor); turns out to be musically identical to his madrigal, 'Non ch'io, non voglio' (K2h3_031_1)"},
    ];

    const examples_table = $('#examples_table');
    for (const example of examples) {
        const row = $('<tr></tr>');
        examples_table.append(row);
        const exampleid = "example" + example.id;
        const id_link = `<a href="#" id=${exampleid}>View</a>`;
        const id_cell = $('<td>' + id_link + '</td>');
        row.append(id_cell);
        const note_cell = $('<td>' + example.desc + '</td>');
        row.append(note_cell);
        $("#"+exampleid).click(() => {
            show_example(example);
        });
    }
}

$(document).ready(() => {
    get_or_set_user_id();
    add_examples_list();

    $('#image_display').zoom();
    $('#result_image_display').zoom();

    $('#search_by_id_button').click(() => {
        do_search();
    });

    $('#search_by_code_button').click(() => {
        document.getElementById("emo_browser_col").style.visibility = "hidden";
        let query_code = document.getElementById("query_code").value.trim();
        let search_num_results = parseInt(document.getElementById("res_disp_select").value);
        if (!query_code.length) {
            alert("You must enter some code!");
        } else {
            code_search(query_code, jaccard, num_results, collections_to_search);
        }
    });

    $('#multi-search-button').click(() => {
        do_search();
    });

    $('#repeat-search-button').click(() => {
        update_colls_to_search();
        repeat_search(searches.length - 1); // Should repeat last search actually done
    });

    $('#random_page_button').click(() => {
        find_random_page();
    });

    $('#uploadForm').on('change', (event) => {
        clear_result_divs();
        const user_image_file = validate_file_upload();
        show_user_image(user_image_file);
    });

    $('#uploadForm').on('submit', (event) => {
        event.preventDefault();
        $('#uploading_status').text('Uploading - Please be patient! ...');
        const user_image_file = validate_file_upload();
        if (user_image_file) {
            submit_upload_form(user_image_file);
        }
    });

    const initial_page_id = 'GB-Lbl_A103b_025_0';
    load_page_query(initial_page_id);
    current_page = {library: 'GB-Lbl', book: 'A103b', page: initial_page_id};
});
