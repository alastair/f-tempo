// Global variables
var num_res_disp = 15; // default
var last_res_disp = 0; // last result to be displayed  NB FIXME - doesn't always work!!
var query_id = "";
var last_query_id = ""; // the last query, to return to NB FIXME (should be an array of queries)
var db_name ="";
var highlighted_result_row = 0;
var jaccard = true;
let corpus_search_mode = true; // false when image search mode

//Arrays for displaying match stats in result list
var matched_words = [];
var words_in_page = [];

// Array of page IDs loaded from database on initialisatiom
let emo_ids;

//    UID for identifying user to logs, etc.


var UID;
var can_store_UID = false;
function get_or_set_UID() {
    if (storageAvailable('localStorage')) {
        // console.log("Local Storage available!")
        UID = localStorage.getItem("userID");
        can_store_UID = true;

        if(!UID) {
            console.log("Setting new UID!")
            UID = uniqueID();
            localStorage.setItem("userID", UID);
        }
    } else {
        console.log("No Local Storage available! Setting new temporary UID")
        UID = uniqueID();
    }
    console.log("UID is " + UID);
}



function load_page_query(id) {
    image= id + ".jpg";
    document.getElementById("q_page_display").innerHTML =
        "Query page: " + id;
    document.getElementById("emo_image_display").innerHTML = "<img id='query_image' src='http://doc.gold.ac.uk/~mas01tc/page_dir_50/"+image+"' role=\"presentation\"/>";
    $('#emo_image_display').zoom();

    //                load_lyrics(id, true);
}

function load_page_query_image(image) {
    document.getElementById("q_page_display").innerHTML = "  Query page: "+image.name;
    $('#emo_image_display').zoom();
}

function get_query_from_id(id) {
    for(var i=0;i<emo_ids.length;i++) {
        if((emo_ids[i].startsWith(">"+id))||(emo_ids[i].startsWith(id))) return emo_ids[i];
    }
    return false
}

// Basic remote search function.
function search(id, jaccard, num_res_disp) {

    // TODO(ra): this should be a POST request probably...
    fetch('api/query/?id=' + id
           + "&jaccard=" + jaccard
           + "&num_results=" + num_res_disp
           + "&threshold=" + threshold,
        {
            method:"GET",
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        })
        .then(response => response.json())
        .then(myJson => show_results(myJson))
        .catch(error => console.log('Request failed', error))
}


function do_search(id,jaccard,num_res_disp) {

    var t0 = performance.now();
    search(id,jaccard,num_res_disp);

    var t1 = performance.now();
    var report_string = 'Search '+id+' took ' + (t1 - t0).toFixed(4) + ' ms ';
    report_string += (jaccard ? 'Jaccard distance' : 'Basic');
    console.log(report_string);

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
    var result_num = 0;
    var results = json;
    const provide_judgements = $('#provide_judgements').is(':checked');


    if (json.length < 2) {
        console.log("No results for " + query_id + "!")
        return false;
    }

    num_res_disp = results.length;

    let table_html = "<thead><tr><th colspan=3>" + num_res_disp + " results - "
                 + results[0].num_words + " words in query</th></tr>"
                 + "<tr><th>ID</th>"
                 + "<th>Match Score</th></tr></thead>"
                 + "<tbody class='table_body'>";



    for(let q = 0; q < results.length; q++) {
        let rank_factor;

        // NOTE: the else here is wrong if we don't assume that the
        // 0th result is the identity match
        if (jaccard) { rank_factor = 1 - results[q].jaccard; }
        else { rank_factor = results[q].num / results[0].num_words };

        matched_words[q] = results[q].num;
        words_in_page[q] = results[q].num_words;
        var result_row_id = "result_row"+q;
        var target_id = results[q].id;
        var sim_choice_id = "sim_choice"+q;
        var sim_id = "sim"+q;
        //               imageSrcs.push("http://doc.gold.ac.uk/~mas01tc/page_dir/"+results[q].id+".jpg");
        imageSrcs.push("http://doc.gold.ac.uk/~mas01tc/page_dir_50/"+results[q].id+".jpg");

        const rank_percentage = (rank_factor * 100).toFixed(2);

        if(corpus_search_mode && results[q].id == query_id) {
            table_html +=
                "<tr class='id_list_name' id='"+result_row_id
                +"' onclick='load_result_image(\""+target_id+"\","+q+","+(rank_factor*100).toFixed(1)+");'>"
                +"<td text-align='center' style='color:blue'><small>" +target_id+"</small></td>"

                + "<td onclick='compare(\""+query_id+"\",\""+results[q].id+"\");'>"
                + '<div class="progress">'
                + '<div class="progress-bar" role="progressbar" style="width: ' + rank_percentage + '%;" aria-valuenow="' + rank_percentage + '" aria-valuemin="0" aria-valuemax="100">' + rank_percentage + '</div>'
                + "</td>";
            if (provide_judgements) {
                table_html += "<td id='"+sim_choice_id+"'>"
                    +"<select class='drop_downs' "
                    +"onchange='log_user_choice(\""+query_id+"\",\""
                    +target_id+"\","
                    +q+", \""
                    +db_name+"\");'"
                    +" id='"+sim_id+"'>"
                    +"<option selected' value='0'></option>"
                    +"<option value='notm'>Not music!</option>"
                    +"</select>"
                    +"</td>"
            }
            table_html += "</tr>";

        } else {
            table_html +=
                "<tr class='id_list_name' id='"+result_row_id
                + "' onclick='load_result_image(\""+target_id+"\","+q+","+(rank_factor*100).toFixed(1)+");'>"
                + "<td text-align='center' style='color:blue'><small>" +target_id+"</small></td>"
                + "<td onclick='compare(\""+query_id+"\",\""+results[q].id+"\");'>"
                + '<div class="progress">'
                + '<div class="progress-bar" role="progressbar" style="width: ' + rank_percentage + '%;" aria-valuenow="' + rank_percentage + '" aria-valuemin="0" aria-valuemax="100">' + rank_percentage + '</div>'
                + "</td>"
            if (provide_judgements) {
                table_html += "<td id='"+sim_choice_id+"'>"
                    + "<select  class='drop_downs'"
                    + "onchange='log_user_choice(\""+query_id+"\",\""
                    + target_id+"\","
                    + q+", "
                    + "\""+db_name+"\");'"
                    + " id='"+sim_id+"'>"
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
    if (jaccard) { top_result_rank_factor = 1 - results[0].jaccard; }
    else { top_result_rank_factor = results[0].num / results[0].num_words };

    load_result_image(top_result_id, 0, top_result_rank_factor);
}


function compare(a,b) {
    var url="compare?qid="+a+"&mid="+b;
    window.open(url, "Compare pages","comp_win");
}


function highlight_result_row(rank) {
    let rowID;
    for(var i=0; i < num_res_disp; i++) {
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
    image = id + ".jpg";

    if (query_id != id) {
        document.getElementById("result_id_msg").innerHTML =
            matched_words[rank]+"/"+words_in_page[rank]+" words in page match the query"; }

    else document.getElementById("result_id_msg").innerHTML = "Query: "+id;
    document.getElementById("result_image_display").innerHTML = "<img width = '400px' src='http://doc.gold.ac.uk/~mas01tc/page_dir_50/"+image+"' />";
    highlight_result_row(rank);
    $('#result_image_display').zoom();
    document.getElementById("query_id").value = id;
    //                load_lyrics(id, false);
}


// Load emo_ids at startup
function get_emo_ids(){
    $.ajax({
        type: "GET",
        url: "api/emo_ids",
        success: (db_emo_ids) => {
            emo_ids = db_emo_ids;
            // console.log(emo_ids);
        }
    });
}

/*********** Utility functions: ***********/
function storageAvailable(type) {
    try {
        var storage = window[type],
            x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
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
    var str = date.getFullYear() + "-" + month + "-" + day + "_" +  hour + ":" + min + ":" + sec;
    return str;
}
function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
// From: https://gist.github.com/gordonbrander/2230317
function uniqueID(){
    function chr4(){
        return Math.random().toString(16).slice(-4);
    }
    return chr4() + chr4() +
        '-' + chr4() +
        '-' + chr4() +
        '-' + chr4() +
        '-' + chr4() + chr4() + chr4();
}

function log_user_choice(query_id,target_id,result_num,database) {
    var the_time = getFormattedDate();
    var sim_id="sim"+result_num;
    var sim_choice = document.getElementById(sim_id).value;
    var log_entry = the_time+"\t";
    if(can_store_UID) {
        log_entry += localStorage.getItem("userID");
    }
    else {
        log_entry += UID;
    }
    log_entry += "\t"
        +query_id + "\t"
        +target_id + "\t"
        +sim_choice + "\t"
        + database + "\t"
        + 'rank: ' + result_num + ": " + (jaccard ? 'Jaccard distance' : 'Basic');

    $.ajax({
        type: "POST",
        url: "api/log",
        data: {
            log_entry: log_entry,
            log: 'user_choice.log'
        },
        dataType:'TEXT',
        success: function(response){
            console.log(response);
        }
    });
}

// Server-side - user need never be aware of this; log needs to be on remote server - see log_search_problem.php
function log_search_problem(query_id,message,database) {
    var the_time = getFormattedDate();
    var log_entry = the_time+"\t";
    if(can_store_UID) {
        log_entry += localStorage.getItem("userID");
    }
    else {
        log_entry += UID;
    }
    log_entry += "\t" +query_id+"\t" + database+"\t" + message;
    $.ajax({
        type: "POST",
        url: "api/log",
        data: {
            log_entry: log_entry,
            log: 'search_problems.log'
        },
        dataType:'TEXT',
        success: function(response){
            console.log(response);
        }
    });
}

// Client-side UI stuff
function checkKey(e) {
    e = e || window.event;
    if([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
    if (e.keyCode == '38') {    // up arrow
        if(highlighted_result_row > 0) {
            var targetID="result_row"+(highlighted_result_row-1);
            document.getElementById(targetID).click();
        }
    }
    else if (e.keyCode == '40') {    // down arrow
        if (highlighted_result_row < num_res_disp) {
            var targetID="result_row"+(highlighted_result_row+1);
        }
        else {
            var targetID="result_row0";
        }
        document.getElementById(targetID).click();
    }
    else if (e.keyCode == '37') {    // left arrow - Search previous page
        find_page_id(false);
        query_id = document.getElementById("query_id").value;
    }
    else if (e.keyCode == '39') {    // right arrow - Search next page
        find_page_id(true);
        query_id = document.getElementById("query_id").value;
    }
}

// Unused??
var dl_text =  "";
// Unused??
function PreviewText() {
    var oFReader = new FileReader();
    oFReader.readAsText(document.getElementById("uploadText").files[0]);
    oFReader.onload = function (oFREvent) {
        dl_text = document.getElementById("uploadTextValue").value = oFREvent.target.result;
        // We now have it so can delete the hidden input value
        document.getElementById("uploadTextValue").value = "";
    };
};



// Client-side, though this needs to interact with server, as book data will be on server, not client
function find_book_id(next) {
    var this_id = document.getElementById("query_id").value;
    if(this_id == null) return false;
    else {
        for(var i=0;i<emo_ids.length;i++) {
            if((emo_ids[i].startsWith(">"+this_id))||(emo_ids[i].startsWith(this_id))) {
                break;
            }
        }
        if(((i==0)&&(!next))||((i==emo_ids.length)&&(next))) return;
        // now find next/prev item starting with a different id
        var this_book = "";
        var id_segs =  this_id.split("_");
        for(j=0;j<id_segs.length-3;j++) this_book+=id_segs[j]+"_";
        this_book+=id_segs[j];
        var new_id = "";
        var new_book = "";
        if(next) {
            for(;i<emo_ids.length;i++) {
                new_book = "";
                new_id = emo_ids[i].split(/[ ,]+/).filter(Boolean)[0];
                id_segs =  new_id.split("_");
                for(j=0;j<id_segs.length-3;j++) new_book+=id_segs[j]+"_";
                new_book+=id_segs[j];
                if(new_book.startsWith(">")) new_book = new_book.substring(1);
                if(new_book != this_book) {
                    break;
                }
            }
        }
        else {
            for(;i>0;i--) {
                // FIXME - stand by for messy recursion!!
                new_book = "";
                new_id = emo_ids[i].split(/[ ,]+/).filter(Boolean)[0];
                id_segs =  new_id.split("_");
                for(j=0;j<id_segs.length-3;j++) new_book+=id_segs[j]+"_";
                new_book+=id_segs[j];
                if(new_book.startsWith(">")) new_book = new_book.substring(1);
                if(new_book != this_book) {
                    // now we are at last image of the previous book,
                    // so find the book before that one
                    // and go to next image - it will be the first of the book we want!
                    this_book = new_book;
                    for(;i>0;i--) {
                        new_book = "";
                        new_id = emo_ids[i].split(/[ ,]+/).filter(Boolean)[0];
                        id_segs =  new_id.split("_");
                        for(j=0;j<id_segs.length-3;j++) new_book+=id_segs[j]+"_";
                        new_book+=id_segs[j];
                        if(new_book.startsWith(">")) new_book = new_book.substring(1);
                        if(new_book != this_book) {
                            if(i>0) i++; //Don't go to next if at first
                            new_id = emo_ids[i].split(/[ ,]+/).filter(Boolean)[0];
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }
    new_id = emo_ids[i].split(/[ ,]+/).filter(Boolean)[0];
    if(new_id.startsWith(">")) new_id = new_id.substring(1);
    document.getElementById("query_id").value = new_id;

    query_id = new_id;
    load_page_query(new_id);
}


function find_page_id(next) {
    var this_id = document.getElementById("query_id").value;
    if(this_id == null) return false;
    else {
        for(var i=0;i<emo_ids.length;i++) {
            if((emo_ids[i].startsWith(">"+this_id))||(emo_ids[i].startsWith(this_id))) {
                break;
            }
        }
        if(((i==0)&&(!next))||((i==emo_ids.length)&&(next))) return;
        var new_id = "";
        if(next) {
            new_id = emo_ids[i+1].split(/[ ,]+/).filter(Boolean)[0];
        }
        else {
            new_id = emo_ids[i-1].split(/[ ,]+/).filter(Boolean)[0];
        }
    }
    if(new_id.startsWith(">")) new_id = new_id.substring(1);
    document.getElementById("query_id").value = new_id;

    query_id = new_id;
    load_page_query(new_id)
}


function basename(path) {
    return path.replace(/\\/g,'/').replace(/.*\//, '');
}


function clear_result_divs() {
    const result_div_ids = ['results_table', 'messages', 'result_image_display', 'result_id_msg'];
    for (const id of result_div_ids) { $('#' + id).empty(); }
}


/*******************************************************************************
 * Browsing EMO
 ******************************************************************************/

function select_new_trial(){
    var new_id = document.getElementById("query_id").value = document.getElementById("trial_select").value;
    // console.log("["+new_id+"]");
    load_page_query_image(new_id+".jpg");
    load_page_query(new_id);
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

    const user_image_file = files[0];
    
    // TODO(ra) more validation - filetype etc.

    return user_image_file;
}


function show_user_image(user_image_file) {
    const reader = new FileReader();
    reader.onload = () => {
        const user_image = $('<img>', { id: 'user_image', src: reader.result });
        $('#user_image_display').empty();
        $('#user_image_display').prepend(user_image);
        $('#user_image_display').zoom();
    };
    reader.readAsDataURL(user_image_file);
}


function submit_upload_form(user_image_file) {
    const formData = new FormData();
    formData.append('user_image_file', user_image_file, user_image_file.name);

    $.ajax({
        url: 'api/image_query',
        method: 'post',
        data: formData,
        processData: false,
        contentType: false,
    }).done(upload_form_callback)
      .fail((xhr, status) => alert(status));
}

function upload_form_callback(data) {
    console.log("Returned: " + data)
    show_results(data);
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
        num_res_disp = document.getElementById("res_disp_select").value;
        threshold = false;
    }
}

function change_ranking_method() {
    const ranking_select = document.getElementById('ranking_select');
    const v = ranking_select.options[ranking_select.selectedIndex].value;
    if (v == 0) { jaccard = true; }
    else { jaccard = false; }
}

function set_corpus_search_mode() {
    // console.log('search with corpus');
    clear_result_divs();
    $('#emo_browser_col').removeClass('d-none');
    $('#image_upload_col').addClass('d-none');
    $('#corpus_search_link').addClass('active');
    $('#image_search_link').removeClass('active');
    corpus_search_mode = true;
}

function set_image_search_mode() {
    // console.log('search with images!');
    clear_result_divs();
    $('#emo_browser_col').addClass('d-none');
    $('#image_upload_col').removeClass('d-none');
    $('#corpus_search_link').removeClass('active');
    $('#image_search_link').addClass('active');
    corpus_search_mode = false;
}



/*******************************************************************************
 * Start 
 ******************************************************************************/

$(document).ready(() => {
    get_or_set_UID();

    $('#image_display').zoom();
    $('#result_image_display').zoom();

    $('#search_button').click(() => {
        query_id = document.getElementById("query_id").value;
        do_search(query_id,jaccard,num_res_disp);
    });

    $('#random_page_button').click(() => {
        document.getElementById("query_id").value = emo_ids[getRandomIntInclusive(0, emo_ids.length)];
        query_id = document.getElementById("query_id").value;
        load_page_query(query_id);
    });

    $('#uploadForm').on('submit', (event) => {
        event.preventDefault();
        clear_result_divs();
        const user_image_file = validate_file_upload();
        if (user_image_file) {
            show_user_image(user_image_file);
            submit_upload_form(user_image_file);
        }
    });

    get_emo_ids();
    const initial_page_id = 'K2h7_092_1'
    document.getElementById("query_id").value = initial_page_id;
    load_page_query(initial_page_id);
});
