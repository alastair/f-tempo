// Function to correct Verovio JSON bug:
function resizeSVG(choice){
    let mySVG;
    if (choice == "query") { mySVG = $("#q_svg_output svg")[0]; }
    else { mySVG = $("#m_svg_output svg")[0]; }

    const width = parseInt(mySVG.getAttributeNS(null, "width"), 10);
    const height = parseInt(mySVG.getAttributeNS(null, "height"), 10);
    const targetWidth = document.getElementById("query_image").width;

    if (targetWidth === width) { return; }
    var aspectRatio = width / height;
    mySVG.setAttributeNS(null, "width", targetWidth + "px");
    mySVG.setAttributeNS(null, "height", (targetWidth / aspectRatio) + "px");
}

// Longest increasing subsequence code from https://rosettacode.org/wiki/Longest_increasing_subsequence#JavaScript
function findIndex(input){
    var len = input.length;
    var maxSeqEndingHere = _.range(len).map(function(){return 1;});
    for(var i = 0; i < len; i++)
        for(var j = i - 1;j >= 0;j--)
            if(input[i] > input[j] && maxSeqEndingHere[j] >= maxSeqEndingHere[i])
                maxSeqEndingHere[i] = maxSeqEndingHere[j] + 1;
    return maxSeqEndingHere;
}

function findSequence(input, result){
    var maxValue = Math.max.apply(null, result);
    var maxIndex = result.indexOf(Math.max.apply(Math, result));
    var output = [];
    output.push(input[maxIndex]);
    for(var i = maxIndex; i >= 0; i--){
        if(maxValue == 0)break;
        if(input[maxIndex] > input[i]  && result[i] == maxValue - 1){
            output.push(input[i]);
            maxValue--;
        }
    }
    output.reverse();
    return output;
}

function lis(str) {
    return findSequence(str, findIndex(str));
}

var ngr_len = 5;
function ngram_string(q_str, n) {
    if(!q_str.length) return false;
    queries = [];
    if(q_str.length < n) {
        queries.push(q_str + "%");
    }
    else if (q_str.length == n) {
        queries.push(q_str);
    }
    else {  
        for(i = 0; i + n <= q_str.length; i++) {
            queries.push(q_str.substr(i, n));
        }
    }
    return queries;
}

var q_com_ng_loc = [];
var m_com_ng_loc = [];
function ngrams_in_common(q_str, m_str, n) {
    q_ngrams = ngram_string(q_str, n);

    for(i = 0;i <= q_ngrams.length;i++) {
        var loc = m_str.indexOf(q_ngrams[i]);
        if(loc >= 0) {
            q_com_ng_loc.push(i);
            m_com_ng_loc.push(loc);
        }
    }
}

function setup_page({
    overlay_colour,
    qid,
    mid,
    q_mel_str,
    m_mel_str,
    qmei_txt,
    mmei_txt,
}) {


    // Verovio code:    
    ///////////////////////////
    /* Create the vrvToolkit */
    ///////////////////////////
    var vrvToolkit = new verovio.toolkit();
    var zoom = 100;
    var pageHeight = 1485;
    var pageWidth = 1050;
    var q_options;

    function set_query_Options() {
        pageHeight = document.getElementById("query_image").height * 100 / zoom;
        pageWidth = document.getElementById("query_image").width * 100 / zoom;
        options = {
            pageHeight: pageHeight,
            pageWidth: pageWidth,
            scale: zoom,
            noLayout: 1
        };
        vrvToolkit.setOptions(options);
    }

    var m_options;
    function set_match_Options() {
        pageHeight = document.getElementById("match_image").height * 100 / zoom;
        pageWidth = document.getElementById("match_image").width * 100 / zoom;

        options = {
            pageHeight: pageHeight,
            pageWidth: pageWidth,
            scale: zoom,
            noLayout: 1
        };
        vrvToolkit.setOptions(options);
    }

    console.log("qid: " + qid); 
    console.log("mid: " + mid); 

    ngrams_in_common(q_mel_str, m_mel_str, ngr_len);

    /*
    var q_lis = lis(q_com_ng_loc)
    var m_lis = lis(m_com_ng_loc)
*/

    var q_lis = q_com_ng_loc;
    var m_lis = m_com_ng_loc;
    console.log("query locs: " + q_lis);
    console.log("match locs: " + m_lis);

    set_query_Options();

    var q_v_svg = vrvToolkit.renderData(qmei_txt);
    $("#q_svg_output").html(q_v_svg);
    resizeSVG("query");

    var q_n = 0;
    $("#q_svg_output g.note").each (function (i){
        if (q_lis.indexOf(i) >= 0) { q_n = ngr_len; }
        if(q_n >= 0) {
            var attr = vrvToolkit.getElementAttr($(this).attr("id"));
            $(this).attr("fill", "red").attr("stroke", "red");
            q_n--;
        }
        else {
            var attr = vrvToolkit.getElementAttr($(this).attr("id"));
            $(this).attr("fill", "blue").attr("stroke", overlay_colour);
        }
    });

    set_match_Options();
    var m_v_svg = vrvToolkit.renderData(mmei_txt);
    $("#m_svg_output").html(m_v_svg);
    resizeSVG("match");

    var m_n = 0;
    $("#m_svg_output g.note").each (function (j){
        if (m_lis.indexOf(j) >= 0) {
            m_n = ngr_len;
        }
        console.log("j m_n " + j + " " + m_n);
        if(m_n >= 0) {
            var attr = vrvToolkit.getElementAttr($(this).attr("id"));
            console.log("match note " + j); 
            $(this).attr("fill", "red").attr("stroke", "red");
            m_n--;
        }
        else {
            var attr = vrvToolkit.getElementAttr($(this).attr("id"));
            $(this).attr("fill", "blue").attr("stroke", overlay_colour);
        }
    });
}
