if(typeof exports === "undefined") {
	var exports = {};
}
///////// Data locations /////////
/*
 At present (16 Apr 2020) these point to separate library collections.
 The collection for Mbs is further split into 8 segments:
    Mbs/Mbs0, Mbs/Mbs1 ... Mbs/Mbs7
 with another 'segment' containing the whole set:
    Mbs/all
*/
const dp_prefix = [];
dp_prefix["D-Bsb_"] = "/storage/ftempo/locations/D-Bsb/";
dp_prefix["D-Mbs_"] = "/storage/ftempo/locations/Mbs/";
dp_prefix["F-Pn_"] = "/storage/ftempo/locations/F-Pn/";
dp_prefix["GB-Lbl_"] = "/storage/ftempo/locations/GB-Lbl/";
dp_prefix["PL_Wn_"] = "/storage/ftempo/locations/PL_Wn/";

// This functions returns the path to the correct subdirectory of D-Mbs data
function get_datapath(id) {
	if(id.startsWith("D-Mbs_")){
		for(var x=0;x<=7;x++) {
			if(D_MBS_ID_PATHS[x].includes(id)) return "D-Mbs/Mbs"+x+"/"+id;
		}
	}
	else {
		return dp_prefix[id.substr(0,id.indexOf("_")+1)];
	}
}
exports.get_datapath = get_datapath;