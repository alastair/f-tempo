# NB This is only suitable for MEI output from later Aruspix versions without "layouts" elements!!!!
# Seems to be after v. 2.0 or thereabouts - mid 2014

# Also - MOST IMPORTANT - it assumes the MEI is 'pretty-printed', i.e. that elements are each on a separate line beginning (perhaps indented) with their tag-name, with no space after the opening "<".

function findAttribute(str) {
	line_num=NR;
	haystack=substr($0,1,length($0)-1);
	n = split(haystack, field);
	for(i=1;i<=n;i++) {
		if(start=index(field[i],str)) {
			return substr(field[i],start+length(str)+2,length(field[i])-start-length(str)-2);
		}
	}
	error_str ="!!ERROR: Attribute "str" NOT FOUND on line "line_num
	return error_str"\n";
}

function note2midi(name, octave) {
	interval["a"]=0; interval["b"]=2; interval["c"]=3; interval["d"]=5; interval["e"]=7; interval["f"]=8; interval["g"]=10;
# A4 is midi 69
	switch(name) {
		case "a":
		case "b":
			return 69 + interval[name] + ((octave-4)*12);
		default:
			return 69 + interval[name] + ((octave-5)*12);			
	}
}
function get_duration(dur) {
	for(i = 0; i<=7;i++) {
		if(dur == durnames[i]) break;
	}
	return(2^i)*120;
}
function get_accid(accid) {
	if(accid == "s") return 1;
	if((accid == "f")||(accid == "ff")) return -1;
	return 0; # unknown case - ignore it!
}
function clean(str) {
# remove ending "/>" if present
if(index(str, "/>")) return substr(str, 1, index(str, "/>")-1);
if(index(str, ">")) return substr(str, 1, index(str, ">")-1);
else return str;
}
function reset_maxmin_pitch() {
	max_pitch = 0;
	min_pitch = 127;	
}
function accid2str(acc) {
	if(accid == 1) return "#";
	if(accid == -1) return "b";
	else return;
}
	
function clef_transpos(str) {
	clef = substr(str,1,1);
	line = substr(str,2,1);
	m = 5;
	startat["C"]=60;
	startat["G"]=67;
	startat["F"]=53;
	for(k=0; diatonic_pitch[k]<startat[clef]; k++);
	k -=  2 * (line-1);
	return diatonic_pitch[k] - 60;
}

function clef_corr_pitch(nn, str) {
	if(str=="") return nn;
	clef = substr(str,1,1);
	line = substr(str,2,1);
	startat["C"]=60;
	startat["G"]=67;
	startat["F"]=53;
	p=0;
	while(diatonic_pitch[p]<60) p++; # default clef is C1
	q = p;
	if(nn<60) while(diatonic_pitch[q]>nn) q--;
	else while(diatonic_pitch[q]<=nn) q++;
	diat_shift = p - q; 
	r=0;
	while(diatonic_pitch[r]<startat[clef]) r++;
	r -=  2 * (line-1);
	newpitch = diatonic_pitch[r - diat_shift - 1];
	return newpitch;
}
function midi2pname(nn) {
	for(z=0;diatonic_pitch[z]<nn;z++);
	return toupper(l[z%7]);
}

function pname2diat(pname, octave) {
	# subtract 3 to base it on C
	if(index(alphabet,pname)>=3) value = (7 * octave) + index(alphabet,pname) - 3;
	else value = (7 * octave) + index(alphabet,pname) + 4;
if(debug) print "index is "index(alphabet,pname)"; "pname octave" is "value;
	return value;
}

BEGIN {
	alphabet = "abcdefghijklmnopqrstuvwxyz";

if(debug) {
	if(outlog=="") outlog = "log";
}
	diatonic = 1;
		
	durnames[0] = "semifusa";
	durnames[1] = "fusa";
	durnames[2] = "semiminima";
	durnames[3] = "minima";
	durnames[4] = "semibrevis";
	durnames[5] = "brevis";
	durnames[6] = "longa";
	durnames[7] = "maxima";
	
	lig_recta = 0;  # for special ligature case - FIXME!!
	
	accid_in_force = 0;
	previous_accid = 0;
	keysig_accid = 0;
	previous_tag = "";
	curr_time = 0;
	curr_pitch = 0;
	curr_pname = "";
	started = 0;
	
	min_pitch = 127;
	max_pitch = 0;

	oct_ints[0]=2;
	oct_ints[1]=2;
	oct_ints[2]=1;
	oct_ints[3]=2;
	oct_ints[4]=2;
	oct_ints[5]=2;
	oct_ints[6]=1; 
	l[0]="c";
	l[1]="d";
	l[2]="e";
	l[3]="f";
	l[4]="g";
	l[5]="a";
	l[6]="b";
	white_key = 0;
	for(i=0;i<=88;) {
		diatonic_pitch[white_key] = i;
		i+=oct_ints[(white_key)%7];
		white_key++;
	}
	
	missing_clef_transpos = 0;
	missing_clef="";
	
	pagewidth = 0;
	pageheight = 0;
	system_num = 0;
	curr_system = 0;
	resting = 0;
	duration = 0;
	items[0,"system"] = 0;
	items[0,"offset"] = 0;
	initial_offset = 50;  # distance from left end beyond which initial clefs can't occur
	glyph_num = 0;
	no_comma = 0;
	
	no_notes = 1;  
}

{  # DURING

	if(NR == 1) {
		thisfile = FILENAME;
		if(debug) {
			printf("\n*************\nDetails for: ") >> outlog;
#			system("basename "thisfile" >> "outlog);
			print "" >> outlog;
		}
	}

	if((items[findAttribute("system"),"system"] > curr_system)&&(curr_system > 0)) {
		page_system[items[findAttribute("system"),"system"]-1, "min_pitch"] = min_pitch;
		page_system[items[findAttribute("system"),"system"]-1, "max_pitch"] = max_pitch;
		page_system[items[findAttribute("system"),"system"]-1, "min_pname"] = themin["pname"];
		page_system[items[findAttribute("system"),"system"]-1, "min_octave"] = themin["octave"];
		page_system[items[findAttribute("system"),"system"]-1, "max_pname"] = themax["pname"];
		page_system[items[findAttribute("system"),"system"]-1, "max_octave"] = themax["octave"];
		page_system[items[findAttribute("system"),"system"]-1, "max_accid"] = accid2str(themax["accid"]);
		page_system[items[findAttribute("system"),"system"]-1, "min_accid"] =accid2str(themin["accid"]);
		reset_maxmin_pitch();
	}

	switch( $1 ) {
		
		case "<page":
		
if(debug==2) print "PAGE: id: "findAttribute("xml:id")" width "findAttribute("page.width")" height "findAttribute("page.height") >> outlog;
		
			pagewidth = findAttribute("page.width");
			pageheight = findAttribute("page.height");
if(debug==1) 	print "MEI line  "NR": PAGE width: "findAttribute("page.width")" height: " findAttribute("page.height")" page lmargin: "findAttribute("page.leftmar")" page rmargin: "findAttribute("page.rightmar") >> outlog;
			break;
			
		case "<system":
if(debug==2) print "SYSTEM: id: "findAttribute("xml:id")" left margin "findAttribute("system.leftmar")" right margin "findAttribute("system.rightmar")" uly "findAttribute("uly") >> outlog;


			system_num++;
			no_notes = 0;
			v_offset = pageheight - findAttribute("uly");
if(debug==1) 	print "MEI line  "NR": SYSTEM "system_num": leftend "findAttribute("system.leftmar")" rightend: "pagewidth - findAttribute("system.rightmar")" top_offset: "v_offset >> outlog;
			page_system[system_num,"leftend"] = findAttribute("system.leftmar");
			page_system[system_num,"rightend"] = pagewidth - findAttribute("system.rightmar");
			page_system[system_num,"top"] = v_offset;
			page_system[system_num,"id"] = findAttribute("xml:id");
			curr_system = system_num;
			break;
			items[findAttribute("system"),"system"] = system_num;
			items[findAttribute("system"),"offset"] = findAttribute("system.leftmar");
			break;
		
		case "<clef":

if(debug==1) print "MEI line "NR":  CLEF line: "findAttribute("line")" shape: "findAttribute("shape")" ulx: "findAttribute("ulx") >> outlog;

	# This is rather dumb, as it allows clef-changes within a system, which are extremely unlikely - 
	# certainly they should not change the system-clef, so we only do that with an initial clef
			glyph_num++;
			
 			glyphs[glyph_num,"id"] = findAttribute("xml:id");
 			glyphs[glyph_num,"system"] =  system_num;
# 			glyphs[glyph_num,"top"] = page_system[glyphs[glyph_num,"system"],"top"];
 			glyphs[glyph_num,"left"] = findAttribute("ulx");
 			glyphs[glyph_num,"type"] = "clef";
 			glyphs[glyph_num,"shape"] = findAttribute("shape");
 			glyphs[glyph_num,"line"] = findAttribute("line");
 			
 			curr_system = system_num;
 			
# 	# now check for F clefs comprising a longa + a double-note-type clef - just wipe out the longa for now:
 			if((glyphs[glyph_num,"shape"] == "F") &&(glyphs[glyph_num - 1,"system"] == curr_system)) {
 				if((glyphs[glyph_num - 1,"type"] == "note") &&(glyphs[glyph_num - 1,"dur"] == "longa")) {
 if(debug)  print "Longa-bass-clef found on system "curr_system >> outlog;
 					glyphs[glyph_num - 1,"type"] = "clef";
 	# world record dreadful hack - silence the note immediately!
 	if((started)&&(!resting)) {
 		curr_time -= get_duration("longa");
 	}
 				}
 			}
 
 			break;
			
		case "</layer":
			break;
		case "<layer":
			break;
			
		case "<mensur":
if(debug==1) print "MEI line "NR":  MENSUR sign: "findAttribute("sign")" slash: "findAttribute("slash")" ulx: "findAttribute("ulx") >> outlog;
			glyph_num++;
			glyphs[glyph_num,"id"] = findAttribute("xml:id");
			glyphs[glyph_num,"system"] =  system_num;
			glyphs[glyph_num,"type"] = "mensur";
			if(substr($2,1,4)=="sign") {
				glyphs[glyph_num,"graph_type"] = "sign";
				glyphs[glyph_num,"sign"] = findAttribute("sign");
				glyphs[glyph_num,"slash"] = findAttribute("slash");
			}
			else if(substr($2,1,3)=="num") {
				glyphs[glyph_num,"graph_type"] = "num";
				glyphs[glyph_num,"num"] = findAttribute("num");
				glyphs[glyph_num,"numbase"] = findAttribute("numbase");
			}
			break;
			
		case "<barLine":
if(debug==1) print "MEI line "NR":  BARLINE ulx: "findAttribute("ulx") >> outlog;

			previous_tag = $1;
			if(curr_system != system_num) {
				missing_clef_transpos = 0;
				missing_clef = "";
			}
			glyph_num++;
			glyphs[glyph_num,"id"] = findAttribute("xml:id");
			glyphs[glyph_num,"system"] =  system_num;
			glyphs[glyph_num,"type"] = "barLine";

			curr_system = system_num;
			next;

		case "<note":
			if(curr_system != system_num) {
				missing_clef_transpos = 0;
				missing_clef = "";
			}

#if(debug==1) print "MEI line "NR": NOTE: pname: "getFieldValue($2)" oct: "getFieldValue($3)" dur: "getFieldValue($4)>> outlog;
if(debug==1) print "MEI line "NR": NOTE: pname: "findAttribute("pname")" oct: "findAttribute("oct")" dur: "findAttribute("dur")" ulx: "findAttribute("ulx")>> outlog;

# Problem where notes appear before a clef in the system (usually because clef isn't recognised.
# Here we just have to insert a guessed clef (ie that of previous system) and adjust pitches correspondingly
# Aruspix seems to assume clef is C1 by default.
			if((items[findAttribute("pname"),"system"]>1)&&(page_system[items[findAttribute("pname"),"system"], "clef"]=="")) {				
				if(length(page_system[items[findAttribute("pname"),"system"]-1,"clef"])==2) { 
					page_system[items[findAttribute("pname"),"system"], "clef"] = "["page_system[items[findAttribute("pname"),"system"]-1, "clef"]"]";
				}
				else {
					page_system[items[findAttribute("pname"),"system"], "clef"] = page_system[items[findAttribute("pname"),"system"]-1,"clef"];
				}
				missing_clef_transpos = clef_transpos(substr(page_system[items[findAttribute("pname"),"system"], "clef"],2,2));
				missing_clef = substr(page_system[items[findAttribute("pname"),"system"], "clef"],2,2);
#print "System " items[findAttribute("pname"),"system"] ": Missing clef change, using "missing_clef >> outlog;  
			}

			pname = findAttribute("pname");
			oct = findAttribute("oct");
			dur = findAttribute("dur");
			
			duration = get_duration(dur);
		#special case for ligature from preceding semibrevis
			if((lig_recta == 1)&&(dur == "brevis")) {
	if(debug==1)  {
		printf("\t: 2nd note of LIGATURE: lig: lig_recta; dur: %d\n",findAttribute("dur")) >> outlog;
		printf("\t: duration was: %d",duration) >> outlog;
		}
				duration /= 2;
	if(debug==1)	printf("; is now: %d\n",duration) >> outlog;
				lig_recta = 0;
			}
						
			glyph_num++;
			no_notes++;
			glyphs[glyph_num,"note_num"] =  no_notes;
			glyphs[glyph_num,"system"] =  system_num;
			glyphs[glyph_num,"type"] = "note";
			glyphs[glyph_num,"pname"] = pname;
			glyphs[glyph_num,"oct"] = oct;
			glyphs[glyph_num,"diat_pitch"] = pname2diat(pname,oct);
			glyphs[glyph_num,"dur"] = dur;
			glyphs[glyph_num,"duration"] = duration;
			glyphs[glyph_num,"id"] = findAttribute("xml:id");
			glyphs[glyph_num,"ulx"] = findAttribute("ulx");
						
			if(pname==curr_pname) {  # is same pitch name as previous note
	 if(debug==1) print "Same name as last note" >> outlog;
				if(previous_accid) {
	 if((debug==1)&&(pname==previous_accid_note)) print "... needs accidental from last note: "previous_accid >> outlog;
					if(pname==previous_accid_note) midipitch = clef_corr_pitch(note2midi(pname, oct),missing_clef) + previous_accid;

					accid_in_force = 0;
					accid_note_in_force = "";
				}
				else {
	 if(debug==1) if(accid_in_force) print "... but needs its own accidental: "accid_in_force >> outlog;
					midipitch = clef_corr_pitch(note2midi(pname, oct),missing_clef) + accid_in_force;
					previous_accid = accid_in_force;
					previous_accid_note = accid_note_in_force;
					accid_in_force = 0;
					accid_note_in_force = "";
				}
			}
			else { # not same pitchname as previous note 
				if(accid_in_force) {
					if(accid_note_in_force == pname) { #normal: accid just before note
	 if(debug==1) print "needs an accidental: "accid_in_force >> outlog;
						midipitch = clef_corr_pitch(note2midi(pname, oct),missing_clef) + accid_in_force;
					}
					else { #a note in between accid and the note it inflects
						midipitch = clef_corr_pitch(note2midi(pname, oct),missing_clef);
					}
					previous_accid = accid_in_force;		
					previous_accid_note = accid_note_in_force;
				}
				else {
					if(previous_accid) {
		if(debug==1)  print "Cancelling previous_accid "previous_accid" on "previous_accid_note >>outlog;
						previous_accid = 0;
						previous_accid_note = "";
					}
					midipitch = clef_corr_pitch(note2midi(pname, oct),missing_clef);
					accid_note_in_force = "";
				}
			}

		# the following assumes only one flat in key-sig - i.e. b flat	
			if(pname == "b") midipitch += keysig_accid;
	
			if((pname == "b")&&(keysig_accid)) glyphs[glyph_num,"accid_in_force"] = keysig_accid;
			else glyphs[glyph_num,"accid_in_force"] = accid_in_force;
			glyphs[glyph_num,"midipitch"] = midipitch;
	
			resting = 0;
			curr_time += duration;
			curr_pitch = midipitch;
			curr_pname = pname;
			started = 1;
	
			if(midipitch > max_pitch) {
				max_pitch = midipitch;
				if(length(missing_clef)==0) {
					themax["pname"] = toupper(pname);
					themax["octave"] = findAttribute("oct");
				}
				else { # pname & octave assume clef is C1 - needs changing
					themax["pname"] = midi2pname(midipitch - accid_in_force);
					themax["octave"] = substr((midipitch/12)+"",1,1)-1;
				}
				themax["accid"] = accid_in_force;
			}
			if(midipitch < min_pitch) {
				min_pitch = midipitch;
				if(length(missing_clef)==0) {
					themin["pname"] = toupper(pname);
					themin["octave"] = findAttribute("oct");
				}
				else { # pname & octave assume clef is C1 - needs changing
					themin["pname"] = midi2pname(midipitch - accid_in_force);
					themin["octave"] = substr((midipitch/12)+"",1,1)-1;
				}
				themin["accid"] = accid_in_force;
			}
			
			curr_system = system_num;

			previous_tag = $1;
				
			# special case of "long/breve" ligature - if this is a semibrevis with lig="recta", then the following brevis must be halved in duration (or something):
				if(substr($5,6,5)=="recta") {
					lig_recta = 1;
					glyphs[glyph_num,"id"] = findAttribute("xml:id");
				}
				else glyphs[glyph_num,"id"] = findAttribute("xml:id");

			next;
		
		case "<rest":
if(debug==1) print "MEI line "NR": REST: dur: "findAttribute("dur")" ploc: "findAttribute("ploc")" oloc: "findAttribute("oloc")>> outlog;

			dur = findAttribute("dur");
			duration = get_duration(dur);
	if(debug==1) if((started)&&(!resting))
			if((started)&&(!resting)) {
			}
	if(debug==1) print "\tduration '"dur"' ("duration")" >> outlog;
			curr_time += duration;
			started = 1;
			resting = 1;
			
	if(debug==1) if(previous_accid) print "Rest cancels accid "previous_accid" on "previous_accid_note >> outlog;
			previous_accid = 0; 
			previous_accid_note = "";
			accid_in_force = 0;
			accid_note_in_force = "";
	# or should accidentals last through rests???
	
			glyph_num++;
			glyphs[glyph_num,"id"] = findAttribute("xml:id");
			glyphs[glyph_num,"system"] =  system_num;
			glyphs[glyph_num,"type"] = "rest";
			glyphs[glyph_num,"dur"] = dur;
			glyphs[glyph_num,"duration"] = duration;
			glyphs[glyph_num,"ploc"] = findAttribute("ploc");
			glyphs[glyph_num,"oloc"] = findAttribute("oloc");
	
			curr_system = system_num;
			previous_tag = $1;
			next;
	
		case "<dot":

if(debug==1) print "MEI line "NR": DOT: ploc: "findAttribute("ploc")" oloc: "findAttribute("oloc")" ulx: "findAttribute("ulx")>> outlog;

			curr_time += duration/2;
	
			glyph_num++;
			glyphs[glyph_num,"id"] = findAttribute("xml:id");
			glyphs[glyph_num,"system"] =  system_num;
			glyphs[glyph_num,"type"] = "dot";
			glyphs[glyph_num-1,"duration"] += glyphs[glyph_num-1,"duration"] / 2;
			glyphs[glyph_num,"ploc"] = findAttribute("ploc");
			glyphs[glyph_num,"oloc"] = findAttribute("oloc");
	
			curr_system = system_num;
			previous_tag = $1;
			next;
			
		case "<accid":
if(debug==1) print "MEI line "NR": ACCID: accid: "findAttribute("accid")" ploc: "findAttribute("ploc")" oloc: "findAttribute("oloc")>> outlog;
			accid = findAttribute("accid");
			accid_note = findAttribute("ploc");
			if(previous_tag == "<clef") {
		# it's a key-signature
	if(debug==1) print "\t"accid" in key-sig" >> outlog;
			# just assume the key-sig is a B flat for now (!!)	
				keysig_accid = get_accid(accid);
				keysig_accid_note = accid_note;
			}
			else {
	if(debug==1) print accid" on next "accid_note >> outlog;
				accid_in_force = get_accid(accid);
				accid_note_in_force = accid_note;
			}
	
			glyph_num++;
			glyphs[glyph_num,"id"] = findAttribute("xml:id");
			glyphs[glyph_num,"system"] =  system_num;
			glyphs[glyph_num,"type"] = "accid";
			glyphs[glyph_num,"accid"] = findAttribute("accid");
			glyphs[glyph_num,"ploc"] = findAttribute("ploc");
			glyphs[glyph_num,"oloc"] = findAttribute("oloc");
	
			curr_system = system_num;
			previous_tag = $1;
			next;
		
		default:
			next;
		}

		previous_tag = $1;
		
}

function prev_note(p) {
	for(;p-1>0; p--) {
		if(glyphs[p-1,"type"]=="note") return p-1;
	}
	return 0;
}
function next_note(id) {
	p=id;
	for(;p<=glyph_num-1; ) {
		p++;
		if(glyphs[p,"type"]=="note") return p;
		if(glyphs[p,"type"]=="rest") return 0;
		
	}
	return 0;
}
function get_prev_notes(i,n) {
	delete prevlist;
	start = i;
	for(k=1;k<=n;k++) {
		if(prev_note(start)==0) return length(prevlist);
		prevlist[k] = prev_note(start);
		start = prev_note(start);
		if(start == 0) return length(prevlist);
	}
	return length(prevlist);
}
function get_next_notes(i,n) {
	delete nextlist;
	start = i;
	for(k=1;k<=n;k++) {
		if(next_note(start)==0) return length(nextlist);
		nextlist[k] = next_note(start);
		start = next_note(start);
		if(start == glyph_num) return length(nextlist);
	}
	return length(nextlist);
}

function basename(file) {
    sub(".*/", "", file)
    return file
  }

END {
# output string of encoded relative melodic intervals to:
	diat_outfile="page.txt"; 
	if(debug==1) print "Writing diatonic melodic interval string to "diat_outfile;
	if(debug==1) print glyph_num" glyphs to process";
	if(debug==1) print "diatonic is "diatonic;

	last_system = 0;
	for(i=0;i<=glyph_num;i++) {
		switch(glyphs[i,"type"]) { 	
			case "note":
				
				if(get_next_notes(i,ngr)==ngr) {
					this_glyph = i;
					pitch_int = 0;
						if (diatonic){
							pitch_int = glyphs[next_note(this_glyph),"diat_pitch"] - glyphs[this_glyph,"diat_pitch"];
						}
						else {
							pitch_int = glyphs[next_note(this_glyph),"midipitch"] - glyphs[this_glyph,"midipitch"];
						}
						if(pitch_int==0) int_symbol = "-";
						else if(pitch_int > 0) {
							int_symbol = toupper(substr(alphabet,pitch_int,1));
						}
						else {
							int_symbol = substr(alphabet,(pitch_int*-1),1)
						}
						
						printf("%s",int_symbol) #>> diat_outfile;
						int_symbol = "";
						if(next_note(this_glyph)) this_glyph = next_note(this_glyph);
						else break;
				}
				break;
		}
		last_system = glyphs[i,"system"];
	}
	print "" # >> diat_outfile;
}
