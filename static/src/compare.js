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


function set_verovio_options(vrvToolkit, image_height, image_width) {
    var zoom = 100;
    let pageHeight = image_height * 100 / zoom;
    let pageWidth = image_width * 100 / zoom;

    options = {
        pageHeight: pageHeight,
        pageWidth: pageWidth,
        scale: zoom,
        noLayout: 1
    };
    vrvToolkit.setOptions(options);
}


function colour_notes(notes, match_locations, ngr_len, match_colour, normal_colour) {
    let remaining_matched_notes;
    for (let i = 0; i < notes.length; i++) {
        if (match_locations.indexOf(i) > -1) {
            // when we find a new start location
            // we reset remaining_matched_notes
            remaining_matched_notes = ngr_len;
        }

        if(remaining_matched_notes) {
            $(notes[i]).attr("fill", match_colour).attr("stroke", match_colour);
            remaining_matched_notes--;
        } else {
            $(notes[i]).attr("fill", normal_colour).attr("stroke", normal_colour);
        }
    }
}


function setup_page({
    overlay_colour,
    q_id,
    m_id,
    q_mel_str,
    m_mel_str,
    qmei_txt,
    mmei_txt,
    ngr_len,
    q_common_ngram_locations,
    m_common_ngram_locations,
}) {
    console.log("q_id: " + q_id); 
    console.log("m_id: " + m_id); 
    console.log("query locs: " + q_common_ngram_locations);
    console.log("match locs: " + m_common_ngram_locations);

    // Setup Verovio toolkit
    var vrvToolkit = new verovio.toolkit();


    const query_image_height = document.getElementById("query_image").height;
    const query_image_width = document.getElementById("query_image").width;
    set_verovio_options(vrvToolkit, query_image_height, query_image_width);
    var q_verovio_svg = vrvToolkit.renderData(qmei_txt);
    $("#q_svg_output").html(q_verovio_svg);
    resizeSVG("query");
    const query_notes = $("#q_svg_output g.note");
    colour_notes(query_notes, q_common_ngram_locations, ngr_len, 'red', 'blue');

    const match_image_height = document.getElementById("match_image").height;
    const match_image_width = document.getElementById("match_image").width;
    set_verovio_options(vrvToolkit, match_image_height, match_image_width);
    var m_v_svg = vrvToolkit.renderData(mmei_txt);
    $("#m_svg_output").html(m_v_svg);
    resizeSVG("match");
    const match_notes = $("#m_svg_output g.note");
    colour_notes(match_notes, m_common_ngram_locations, ngr_len, 'red', 'blue');
}
