//Cosine similarity code (from: 
// https://medium.com/@sumn2u/string-similarity-comparision-in-js-with-examples-4bae35f13968)    
    function termFreqMap(str) {
        var words = str.split(' ');
        var termFreq = {};
        words.forEach(function(w) {
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
// End of cosine similarity code

// Global variables:
var ngr_len = 5;
var q_highlight_rects = [];
var m_highlight_rects = [];
var q_ngs_in_match = [];
var m_ngs_in_query = [];
var drawq = drawm = false; // drawing layer
var query_notes = [];
var match_notes = [];
var q_sel_rects = [];
var m_sel_rects = [];
var q_diat_str = "";
var q_diat_str_init = "";
var m_diat_str = "";
var m_diat_str_init = "";
/**************************/

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

function newcolour_notes(notes, isquery) {
    if(isquery) {
	    for (var j = 0; j < query_notes.length; j++) {
		   if(typeof m_ngs_in_query[j] === "undefined") {
			   colour = "Teal";
			   $(notes[j]).attr("fill", colour).attr("stroke", colour);
			   continue;
		   }
		   var colour = m_ngs_in_query[j].length? "HotPink" : "Teal";
		   $(notes[j]).attr("fill", colour).attr("stroke", colour);
	    }
    }
    else { 
	    for (var j = 0; j < match_notes.length; j++) {
		   if(typeof q_ngs_in_match[j] === "undefined") {
			   colour = "Teal";
			   $(notes[j]).attr("fill", colour).attr("stroke", colour);
			   continue;
		   }
		   var colour = q_ngs_in_match[j].length? "HotPink" : "Teal";
		   $(notes[j]).attr("fill", colour).attr("stroke", colour);
	    }
    }
}

function convertCoords(elem) {
  const x = elem.getBBox().x;
  const y = elem.getBBox().y;
  var offset = elem.closest("svg").parentElement.getBoundingClientRect();
  var matrix = elem.getScreenCTM();
  return {
      x: (matrix.a * x) + (matrix.c * y) + matrix.e - offset.left,
      y: (matrix.b * x) + (matrix.d * y) + matrix.f - offset.top
  };
}

function screenToSVG(svg, x, y) { // svg is the svg DOM node
  var pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  var cursorPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {x: Math.floor(cursorPt.x), y: Math.floor(cursorPt.y)}
}
function svgToScreen(element) {
  var rect = element.getBoundingClientRect();
  return {x: rect.left, y: rect.top, width: rect.width, height: rect.height};
}

// get index of obj.id in query_notes or match_notes depending on boolean val of q (is query)
function getIndexFromBoxArray(val,q) {
	if(q) {
	//	var index = q_sel_rects.indexOf(val);
		for(var i=0;i<query_notes.length;i++) {
			if(val == query_notes[i].id) return i;
		}
	}
	else {
	//	var index = m_sel_rects.indexOf(val);
		for(var i=0;i<match_notes.length;i++) {
			if(val == match_notes[i].id) return i;
		}
	}
	return index;
}
// Two functions provided by David Lewis 4 Jan 2020
function getSystem(element){
 var sysObj = element.closest('.system');
 return sysObj.id;
}
function boundingBoxesForElements(elements) {
	var systems = {};
	if(!elements.length) return systems;

	// first get the vert/horiz screen offsets of the entire div into which all SVG is drawn 
	var parentBox = elements[0].closest('div').childNodes[0].getBoundingClientRect();
	var offsetY = parentBox.top;
	var offsetX = parentBox.left;
	
	for(var i=0; i<elements.length; i++){
	if(!elements[i]) continue;

	// The childNodes here are the top and bottom staff-lines themselves, 
	// but y is screen-relative (??), so we add offsetY; 
	// the last tweak (+- 8) is to get a reasonable 'margin' around the box
	var elTop = convertCoords(elements[i].closest('.staff').childNodes[1]).y + offsetY - 8;
	var elBot = convertCoords(elements[i].closest('.staff').childNodes[9]).y + offsetY + 8;

	var elementRect = elements[i].getBoundingClientRect();
	var system = getSystem(elements[i]);
	if(systems[system]) {
	systems[system].top = elTop; 
	systems[system].bottom = elBot;
	systems[system].left = (systems[system].left || systems[system].left===0) 
				? Math.min(elementRect.x, systems[system].left) : elementRect.x;
	systems[system].right = systems[system].right ? Math.max(elementRect.x+elementRect.width, systems[system].right) 
				: elementRect.x+elementRect.width;
	} else {
	systems[system] = {top: elTop, bottom: elBot,
				left: elementRect.x, right: elementRect.x+elementRect.width};
	}
	}
	for(s in systems) {
	systems[s].top -= offsetY;
	systems[s].bottom -= offsetY;
	systems[s].left -= offsetX;
	systems[s].right -= offsetX;
	}
	return systems;
}

function highlight_box(box) {
//	box.fill({ color: 'blue' });
	box.attr({'fill-opacity':0.3});	
	box.attr({'stroke':"orange"});	
}
function unhighlight_box(box) {
	box.hide();
}

function highlight_system_box(sel_box,isquery) {

//Clear arrays

	var note_id = sel_box.attr("note_id")
	var index = getIndexFromBoxArray(note_id,isquery);
	var m_highlight_rect_dims = [];
	var q_highlight_rect_dims = [];
	var q_sel_elements = [];
	var m_sel_elements = [];

// Clear arrays:
	q_highlight_rects.length = m_highlight_rects.length = 0;
	q_sel_elements.length = m_sel_elements.length = 0;

	if(isquery) {
		var match_notes_list = m_ngs_in_query[index];
		if(match_notes_list.length>0) {
			if(index > query_notes.length - ngr_len -1) return;
			document.getElementById("message").innerHTML="query: note "+index;
//	First, highlight 'this' box and those of the following ngram
			for(offset=0;index+offset<query_notes.length;offset++) {
				if(offset>ngr_len) break; 
				q_sel_elements.push(query_notes[index+offset]);
			}
	// Build and highlight all the rects that need highlighting
			q_highlight_rect_dims = boundingBoxesForElements(q_sel_elements); 
			var q_hl_r_d_array = Object.values(q_highlight_rect_dims);
			qsel_svg = drawq;
			for(var r=0; r<q_hl_r_d_array.length;r++) {
				q_highlight_rects[r] = qsel_svg.rect(q_hl_r_d_array[r].right - q_hl_r_d_array[r].left,q_hl_r_d_array[r].bottom - q_hl_r_d_array[r].top);
				q_highlight_rects[r].move(q_hl_r_d_array[r].left,q_hl_r_d_array[r].top);
				q_highlight_rects[r].addClass("highlight");
				highlight_box(q_highlight_rects[r]);
			}
			q_sel_elements.length = 0;

//	build array of rect-dimensions in the match pane as needed
			m_sel_elements.length = 0;
			document.getElementById("message").innerHTML += " match_notes:"
			for(var t=0;t<match_notes_list.length;t++) {
				if(typeof match_notes_list[t] === "undefined") continue;
				document.getElementById("message").innerHTML += " "+match_notes_list[t];
//				var start = match_notes_list[t]+1;
				var start = match_notes_list[t];
				for(offset=0;start+offset<m_sel_rects.length;offset++) {
					if(offset>ngr_len) break;
					m_sel_elements.push(match_notes[start+offset]);
					
					if(m_sel_elements.length == ngr_len + 1){				
				// Build and highlight all the rects that need highlighting
						m_highlight_rect_dims = boundingBoxesForElements(m_sel_elements);
						var m_hl_r_d_array = Object.values(m_highlight_rect_dims);
						msel_svg = drawm;
						for(var n=0; n<m_hl_r_d_array.length;n++) {
							m_highlight_rects[n] = msel_svg.rect(m_hl_r_d_array[n].right - m_hl_r_d_array[n].left,m_hl_r_d_array[n].bottom - m_hl_r_d_array[n].top);
							m_highlight_rects[n].move(m_hl_r_d_array[n].left,m_hl_r_d_array[n].top);
							m_highlight_rects[n].addClass("highlight");
							highlight_box(m_highlight_rects[n]);
						}
						m_sel_elements.length = 0;
					}
				}
			}
		}
	}
	else {

		var query_notes_list = q_ngs_in_match[index];
		if(query_notes_list.length>0) {
			if(index > match_notes.length - ngr_len -1) return;
			document.getElementById("message").innerHTML="match: note "+index;
//	First, highlight 'this' box and those of the following ngram
			for(offset=0;index+offset<match_notes.length;offset++) {
				if(offset>ngr_len) break; 
				m_sel_elements.push(match_notes[index+offset]);
			}
	// Build and highlight all the rects that need highlighting
			m_highlight_rect_dims = boundingBoxesForElements(m_sel_elements); 
			var m_hl_r_d_array = Object.values(m_highlight_rect_dims);
			msel_svg = drawm;
			for(var n=0; n<m_hl_r_d_array.length;n++) {
				m_highlight_rects[n] = msel_svg.rect(m_hl_r_d_array[n].right - m_hl_r_d_array[n].left,m_hl_r_d_array[n].bottom - m_hl_r_d_array[n].top);
				m_highlight_rects[n].move(m_hl_r_d_array[n].left,m_hl_r_d_array[n].top);
				m_highlight_rects[n].addClass("highlight");
				highlight_box(m_highlight_rects[n]);
			}
			m_sel_elements.length = 0;

//	build array of rect-dimensions in the query pane as needed
			q_sel_elements.length = 0;
			document.getElementById("message").innerHTML += " query_notes:"
			for(var t=0;t<query_notes_list.length;t++) {
				if(typeof query_notes_list[t] === "undefined") continue;
				document.getElementById("message").innerHTML += " "+query_notes_list[t];
//				var start = query_notes_list[t]+1;
				var start = query_notes_list[t];
				for(offset=0;start+offset<q_sel_rects.length;offset++) {
					if(offset>ngr_len) break;
					q_sel_elements.push(query_notes[start+offset]);
					
					if(q_sel_elements.length == ngr_len + 1){				
				// Build and highlight all the rects that need highlighting
						q_highlight_rect_dims = boundingBoxesForElements(q_sel_elements);
						var q_hl_r_d_array = Object.values(q_highlight_rect_dims);
						qsel_svg = drawq;
						for(var r=0; r<q_hl_r_d_array.length;r++) {
							q_highlight_rects[r] = qsel_svg.rect(q_hl_r_d_array[r].right - q_hl_r_d_array[r].left,q_hl_r_d_array[r].bottom - q_hl_r_d_array[r].top);
							q_highlight_rects[r].move(q_hl_r_d_array[r].left,q_hl_r_d_array[r].top);
							q_highlight_rects[r].addClass("highlight");
							highlight_box(q_highlight_rects[r]);
						}
						q_sel_elements.length = 0;
					}
				}
			}
		}
	}
}

function unhighlight_system_boxes() {
//	for(var r in q_highlight_rects) unhighlight_box(q_highlight_rects[r]);
//	for(var n in m_highlight_rects) unhighlight_box(m_highlight_rects[n]);

	$("svg .highlight").fadeOut(200);
//	$("svg .highlight").remove();
		
}

function findAllIndexes(source, find) {
  var result = [];
  for (i = 0; i < source.length-find.length; ++i) {
    if (source.substring(i, i + find.length) == find) {
      result.push(i);
    }
    else result.push(-1);
  }
  return result;
}

function getCommonNgrams(q_str,m_str) {
// clear global arrays q_ngs_in_match & m_ngs_in_query
	q_ngs_in_match.length = m_ngs_in_query.length = 0;
	
	var ql=q_str.length; ml=m_str.length;
	var q_ngrams = ngram_array(q_str,ngr_len); //cut last char
	var m_ngrams = ngram_array(m_str,ngr_len);
//	var last_q_ng_pos = q_str.length-ngr_len;
	var last_q_ng_pos = q_str.length;
	for(var i=0;i<=last_q_ng_pos;i++) {
		if(typeof m_ngs_in_query[i] === "undefined") m_ngs_in_query[i] = [];
//		if(i>=ngr_len) {
		if(q_ngrams[i]) {
			let found = findAllIndexes(m_str,q_ngrams[i]);
			for(let n of found) {
				if(n >= 0) m_ngs_in_query[i].push(n); 
			}
		}
	}
	// fill up blank slots at end
//	for(var x=0;x<=ngr_len;x++) m_ngs_in_query[i+x]=[];

	var last_m_ng_pos = m_str.length-ngr_len;
	var last_m_ng_pos = m_str.length;
	for(var i=0;i<=last_m_ng_pos;i++) {
		if(typeof q_ngs_in_match[i] === "undefined") q_ngs_in_match[i] = [];
//		if(i>=ngr_len) {
		if(m_ngrams[i]) {
			let found = findAllIndexes(q_str,m_ngrams[i]);
			for(let n of found) {
				if(n >= 0) q_ngs_in_match[i].push(n); 
			}
		}
	}
	// fill up blank slots at end
//	for(var y=0;y<=ngr_len;y++) q_ngs_in_match[i+y]=[];
	
	console.log("Ngram length: "+ngr_len+" - Cosine similarity = "+textCosineSimilarity(ngram_array(q_str,ngr_len).join(' '), ngram_array(m_str,ngr_len).join(' ')));
}

function buildSelectionBoxes () {
 //  push bounding box (.rect) of each drawn query note to query and match arrays, for selection purposes
    for(i=0;i<query_notes.length;i++) {
	var q_notewidth =  svgToScreen(query_notes[i].closest("g .note")).width;
	var q_noteheight = svgToScreen(query_notes[i].closest("g .note")).height; 
	q_sel_rects[i]=drawq.rect(q_notewidth,q_noteheight);
	q_sel_rects[i].move(convertCoords(query_notes[i]).x-1, convertCoords(query_notes[i]).y);
	q_sel_rects[i].attr('class','q_selRect');
	q_sel_rects[i].attr('fill-opacity','0.2'); // could lose this
	q_sel_rects[i].attr('fill','transparent');
	q_sel_rects[i].attr('note_id',query_notes[i].id);

	q_sel_rects[i].mouseover(function() {  highlight_system_box(this,true); });
	q_sel_rects[i].mouseleave(function() {  unhighlight_system_boxes() });	
    }
	drawq.attr("id" , "q_draw_area");
  
    for(i=0;i<match_notes.length;i++) {
	var m_notewidth =  svgToScreen(match_notes[i].closest("g .note")).width;
	var m_noteheight = svgToScreen(match_notes[i].closest("g .note")).height;
	m_sel_rects[i]=drawm.rect(m_notewidth,m_noteheight);
	m_sel_rects[i].move(convertCoords(match_notes[i]).x-1,convertCoords(match_notes[i]).y);
	m_sel_rects[i].attr('class','m_selRect');
	m_sel_rects[i].attr('fill-opacity','0.2'); // could lose this
	m_sel_rects[i].attr('fill','transparent');
	m_sel_rects[i].attr('note_id',match_notes[i].id);
	m_sel_rects[i].mouseover(function() {  highlight_system_box(this,false); });
	m_sel_rects[i].mouseleave(function() {  unhighlight_system_boxes() });	
    }
    drawm.attr("id" , "m_draw_area");
}

function toggle(b){b.value=(b.value=="true")?"false":"true";}
function hide_show_image(isquery) {
	if(isquery) {
		toggle(document.getElementById("hide_q_image"));
		if(document.getElementById("hide_q_image").value=="true") {
			document.getElementById("query_image").style.visibility="hidden";
			document.getElementById("hide_q_image").innerText="Show image";
		}
		else {
			document.getElementById("query_image").style.visibility="visible";
			document.getElementById("hide_q_image").innerText="Hide image";
		}
	}
	else {
		toggle(document.getElementById("hide_m_image"));
		if(document.getElementById("hide_m_image").value=="true") {
			document.getElementById("match_image").style.visibility="hidden";
			document.getElementById("hide_m_image").innerText="Show image";
		}
		else {
			document.getElementById("match_image").style.visibility="visible";
			document.getElementById("hide_m_image").innerText="Hide image";
		}
	}
}


function trim_str(str) {
	if(str.startsWith("\"")) str=str.substr(1);
	if(str.endsWith("\"")) str=str.substr(0,str.length-2);
	return str;
}
function setup_page({
    q_id,
    m_id,
    q_jpg_url,
    m_jpg_url,
    q_mei,
    m_mei,
    q_diat_str,
    m_diat_str,
    ng_len,
}) {
// Trim strings:
	q_diat_str = trim_str(q_diat_str);
	m_diat_str = trim_str(m_diat_str);
	q_diat_str_init = q_diat_str;
	m_diat_str_init = m_diat_str;
	
	console.log("Query: "+ q_diat_str_init);
	console.log("Match: "+ m_diat_str_init);
	console.log("Initial ng_len is "+ng_len)

	if(ng_len) {
		if((parseInt(ng_len)>12)||(parseInt(ng_len)<3)) {
			console.log("ng_len set to "+ng_len+" in URL")
			console.log("Cannot set ngram length to "+ng_len+"! Resetting to "+ngr_len);
		}
		else {
			ngr_len=parseInt(ng_len);
			document.getElementById("ngr_len_change").value=ngr_len.toString();
		}
	}
	else {
		ngr_len = parseInt(document.getElementById("ngr_len_change").value);
	}
	
	console.log("Ngram length: "+ngr_len);

	m_ngs_in_query = [];
	q_ngs_in_match = [];	
//	getCommonNgrams(q_diat_str,m_diat_str);
	getCommonNgrams(q_diat_str_init,m_diat_str_init);

	// Setup Verovio toolkit
	var vrvToolkit = new verovio.toolkit();
	const query_image_height = document.getElementById("query_image").height;
	const query_image_width = document.getElementById("query_image").width;
	set_verovio_options(vrvToolkit, query_image_height, query_image_width);
	var q_verovio_svg = vrvToolkit.renderData(q_mei);
	$("#q_svg_output").html(q_verovio_svg);
	resizeSVG("query");

	drawq = SVG().addTo('#q_svg_output svg');
	query_notes = $("#q_svg_output g.note");
	
	newcolour_notes(query_notes, true);
	
	const match_image_height = document.getElementById("match_image").height;
	const match_image_width = document.getElementById("match_image").width;
	set_verovio_options(vrvToolkit, match_image_height, match_image_width);
	var m_v_svg = vrvToolkit.renderData(m_mei);
	$("#m_svg_output").html(m_v_svg);
	resizeSVG("match");

	drawm = SVG().addTo('#m_svg_output svg');
	match_notes = $("#m_svg_output g.note");
	
	newcolour_notes(match_notes, false);
	
	buildSelectionBoxes();

}
function wipeSelectionBoxes(){
	$(".q_selRect, .m_selRect").remove();
}
function redrawPage(){
	// Used when ngram size is changed
	m_ngs_in_query = [];
	q_ngs_in_match = [];	
	ngr_len = parseInt(document.getElementById("ngr_len_change").value);
	// Remove existing boxes
	wipeSelectionBoxes();
	// Rerun ngram matching
	getCommonNgrams(q_diat_str_init,m_diat_str_init);
	newcolour_notes(query_notes, true);
	newcolour_notes(match_notes, false);
	buildSelectionBoxes();
}
