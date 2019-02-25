
		// Server
		// Global variables:
			var trie_loaded = false;
			var lines = [];
			var database_data = "";
			var query_id="";

		// Server-based functions
					
			function load_arbitrary_database() {
				var ng_len = get_ng_len();
				if((ng_len>2)&&(ng_len<16)) {
					db_name ="ngrams/emo_"+ng_len+"grams.txt";
					console.log("Trying to load "+db_name);
					get_and_load_database(db_name);
				}
				else alert("Loading database failed!");
			}
			
			function load_full_maws_database() {
					db_name ="maw_4-8_sameline.txt";
					console.log("Trying to load "+db_name);
					get_and_load_database(db_name);
			}
			
			function get_and_load_database(the_db){
				var Tstart = performance.now();
				hide_query_panel();
				hide_display_panel();
				document.getElementById("database_name").innerHTML = "<small>Loading database ...</small>";
				if(!the_db) the_db = document.getElementById("maw_data").value;
				db_name = the_db;
				console.log("database: "+the_db);
				$.ajax({
					type: "GET",
					url: "get_database.php",
					data: {database: the_db},
					success: function(data) {
						load_data(data);
						var Tend = performance.now();
						document.getElementById("database_name").innerHTML = "<i>"+db_name+"</i> loaded";
						show_query_panel();
						console.log("Loaded in "+((Tend-Tstart)/1000).toFixed(2)+" sec");
					}
				});
			}
			
			// array containing objects holding number of MAWs for each id in database
			// for use in normalisation elsewhere
			var word_tot = [];

			function load_data(data) {
				document.getElementById("database_name").innerHTML = "Loading database ...";
			//clear text-entry boxes:
				document.getElementById("idText").innerHTML = "";
				
				lines = data.split("\n");
				console.log(lines.length+" lines to read");
				for(i in lines) {
					bits = lines[i].split(/[ ,]+/).filter(Boolean);
					if (typeof bits[0] !== 'undefined') {
						var id = "";
						// chop initial ">" from fasta format
						if(bits[0].charAt(0)==">") id = bits[0].substring(1); 
						else id = bits[0]; 
						word_tot[id] = bits.length - 1;

						for(j=1;j<bits.length;j++) {
							trie.id_add(bits[j],id);	
						}
					}
					else {
						console.log(i+" lines of data loaded!")
					//	console.log('trie count words is: ', trie.countWords()); 
						document.getElementById("messages").innerHTML = "";
					}
				}
				trie_loaded = true;
	//			save_trie_json();
			}

			function save_trie_json() {
				var trie_json = JSON.stringify(trie);
				var json_chunk = JSON.stringify(trie).substring(0,500);
				console.log("JSON begins: \n"+json_chunk);
				json_name = "emo_data/databases/"+db_name.substring(0,db_name.lastIndexOf(".")) + ".json";
				
				console.log("Saving trie for "+"emo_data/databases/"+db_name+" as "+json_name);
				$.ajax({
					type: "POST",
					url: "save_json_database.php",
					data: {json_db: json_name, trie_json: trie_json},
					success: function(result) {
						console.log("Saving JSON to "+json_name+"...");
						console.log(result);
					}
				});
				
			}
			function load_trie_json() {
			}
			
			var jaccard = true;
			function searchTrie(complete) {

			//Starts on server			
			// This needs to be a function which takes a query from the client ...
				if(!trie_loaded) {
					alert("Please choose and load database!");
					return;
				}
				else {
					// save the previous query_id in case user wants to return with left-arrow				
					last_query_id = query_id;
					
					// wipe last result display:
					load_result_image(false);
					hide_result_table();
					
					var x = "";
					if(complete) x = document.getElementById("idText").value;
					else x = get_query_from_id(document.getElementById("idText").value);
					if(!x) {
						document.getElementById("messages").innerHTML="<p style='color:red'>ID not found!</p>";
						x_wds = complete? document.getElementById("idText").value.split : document.getElementById("idText").value.split(" ");
						log_search_problem(x_wds[0],"ID not found", db_name);
						document.getElementById("q_page_display").innerHTML="";
						document.getElementById("img_display").innerHTML="";
						return false;
					}
					else {					
						show_display_panel();
						var queryArray = x.split(/\s/);
						var id = query_id = queryArray[0];
						if(id.substring(0,1)==">") query_id = query_id.substring(1);
						wds_in_q = queryArray.length-1
						if(wds_in_q < 6) {
							document.getElementById("messages").innerHTML = "Not enough data in query. Try again!";
							log_search_problem(query_id,"Not enough words in query ("+wds_in_q+")", db_name);
							document.getElementById("img_display").innerHTML="";
							return;
						}
						document.getElementById("messages").innerHTML=wds_in_q+" words in query";
					}
					load_page_query(query_id);
					var words = [];
					for(i=1,qa_length=queryArray.length;i<qa_length;i++) {
						if(queryArray[i].length) {
							words.push(queryArray[i]);
						}
					}
					var res = false;
					var score = [];
					for(w in words) {
						res = trie.getIDs(words[w]);
						if(res != false) {
							var item = false;
							for(let item of res.values()) {
								if (!score[item])  {
				//					score[item] = new Array();
									score[item] = {};
									score[item].id = item;
									score[item].num = 0;
								}
								score[item].num++;
							}
						}
					}
				}
			// ... and then returns the result (as JSON?) to the client
				
			// From here, it's client-side to end of function searchTrie().
				var result_num = 0;
				var scores_pruned = [];
				for(var g in score) {
					if(score[g].num > 1) {
						scores_pruned[result_num] = {};
						scores_pruned[result_num].id=score[g].id;
						scores_pruned[result_num].num=score[g].num;
						scores_pruned[result_num].num_words= word_tot[scores_pruned[result_num].id];
						scores_pruned[result_num].jaccard = 1-(score[g].num/(scores_pruned[result_num].num_words+wds_in_q-scores_pruned[result_num].num));
						result_num++;
					}
				}				
				if(result_num <= 1) {
					document.getElementById("messages").innerHTML = "No results! Try a new search!";
					hide_result_table();
					return;
				}
				show_result_table();
				var table_html = "";
				table_html = "<thead><tr><th colspan='2'><small>"+num_res_disp+" best</small></th> <th><small>Relation to query</small></th> </tr></thead>";
				table_html += "<tbody class='table_body'>";
				var db =  document.getElementById("maw_data").value;
				// rank pruned results
				if(jaccard) scores_pruned.sort(function(a, b){return a.jaccard-b.jaccard}); // Ascending, as 0 is identity match
				else scores_pruned.sort(function(a, b){return b.num-a.num}); // Descending
				last_res_disp = 0;
				for(q=0;q<=num_res_disp;q++) if(q<scores_pruned.length) {
				// for Jaccard distance
					if(jaccard) var rank_factor = 1 - scores_pruned[q].jaccard;
				// for basic search
					else var rank_factor = scores_pruned[q].num / scores_pruned[0].num;					
matched_words[q] = scores_pruned[q].num;
words_in_page[q] = word_tot[scores_pruned[q].id];
					var result_row_id = "result_row"+q;
					var target_id = scores_pruned[q].id;
					var sim_choice_id = "sim_choice"+q;
					var sim_id = "sim"+q;
					if(scores_pruned[q].id == query_id)   {
						table_html +=
							"<tr class='id_list_name' id='"+result_row_id
							+"' onclick='load_result_image(\""+target_id+"\","+q+","+(rank_factor*100).toFixed(1)+");'>"
								+"<td text-align='center' style='color:blue'><small>" +target_id+"</small></td>"
								+"<td style='border-left:"+(rank_factor*100).toFixed(2)+"px solid red'  ></td>"
								+"<td width='160px' id='"+sim_choice_id+"'>"
									+"<select class='drop_downs' "
										+"onchange='log_user_choice(\""+query_id+"\",\""
											+target_id+"\","
											+q+", \""
											+db_name+"\");'"
										+" id='"+sim_id+"'>"
											+"<option class='u_choice' selected' value='0'></option>"
											+"<option class='u_choice'  value='notm'>Not music!</option>"
									+"</select>"						
								+"</td>"+"</tr>";
					}
					else {
						table_html +=
							"<tr class='id_list_name' id='"+result_row_id
							+"' onclick='load_result_image(\""+target_id+"\","+q+","+(rank_factor*100).toFixed(1)+");'>"
								+"<td text-align='center' style='color:blue'><small>" +target_id+"</small></td>"
								+"<td style='border-left:"+(rank_factor*100).toFixed(2)+"px solid red' ></td>"
								+ "<td id='"+sim_choice_id+"'>"
									+"<select  class='drop_downs'"
										+"onchange='log_user_choice(\""+query_id+"\",\""
											+target_id+"\","
											+q+", "
											+"\""+db_name+"\");'"
										+" id='"+sim_id+"'>"
											+"<option class='u_choice' selected' value='0'></option>"
											+"<option class='u_choice' value='dupl'>Duplicate page</option>"
											+"<option class='u_choice' value='same'>Same music</option>"
											+"<option class='u_choice' value='relv'>Related music</option>"
											+"<option class='u_choice' value='notm'>Not music!</option>"
									+"</select>"		
								+"</td>"+"</tr>";
						last_res_disp++;
						}
				}
				table_html += "</tbody>";
				document.getElementById('result_table').innerHTML = table_html;
				load_result_image(query_id, 0, 100);
				show_result_image();
			}
		
		// Probably should be server-side
			// For timing searches:
			function do_search(complete) {
					var t0 = performance.now();
					searchTrie(complete);
					var t1 = performance.now();
					var report_string = 'Search '+query_id+' ('+wds_in_q+' words) took ' + (t1 - t0).toFixed(4) + ' ms ';
					report_string += document.getElementById('rank_toggle').innerText;
					console.log(report_string);
				
			}

			function get_query_from_id(id) {
	//			console.log("Looking for id "+id+" in "+lines.length+" lines of database");
				for(var i=0;i<lines.length;i++) {
					if((lines[i].startsWith(">"+id))||(lines[i].startsWith(id))) return lines[i];
				}
				return false
			}
			
		/*If there exists a set of lyric-syllables recognised by Tesseract for this id,
		display it in the appropriate place*/	
			function load_lyrics(our_id, is_query) {
				if(our_id.charAt(0)==">") our_id = our_id.substring(1);
				var display_div_id = is_query? "q_text_display" : "t_text_display";
				document.getElementById(display_div_id).innerHTML = our_id+" Lyrics here!"
				$.ajax({
					type: "GET",
					url: "get_lyrics.php",
					data: {lid: our_id},
					success: function(data) {
						load_data(data);
						document.getElementById(display_div_id).innerHTML = "<small>"+data+"</small>";
					}
				});
				
			}
			
			function log_user_choice(query_id,target_id,result_num,database) {
				var the_time = getFormattedDate();
				var sim_id="sim"+result_num;
				var sim_choice = document.getElementById(sim_id).value;
				var reportString = the_time+"\t";
				if(can_store_UID) {
					reportString += localStorage.getItem("userID");
				}
				else {
					reportString += UID;
				}
				reportString += "\t" 
							+query_id + "\t" 
							+target_id + "\t" 
							+sim_choice + "\t"
							+ database + "\t"
							+ 'rank: ' + result_num + ": " + document.getElementById('rank_toggle').innerText;
				$.ajax({
					type: "POST",
					url: "log_user_interaction.php",
					data: {reportString: reportString},
					dataType:'TEXT', 
					success: function(response){
						console.log("PHP received: "+response);
						// put on console what server sent back...
					}
				});
			}
			function log_search_problem(query_id,message,database) {
				var the_time = getFormattedDate();
				var reportString = the_time+"\t";
				if(can_store_UID) {
					reportString += localStorage.getItem("userID");
				}
				else {
					reportString += UID;
				}
				reportString += "\t" +query_id+"\t" + database+"\t" + message;
				$.ajax({
					type: "POST",
					url: "log_search_problem.php",
					data: {reportString: reportString},
					dataType:'TEXT', 
					success: function(response){
						console.log("PHP received: "+response);
						// put on console what server sent back...
					}
				});
			}

		//Server-side, but to be controlled from client
			function switch_rank() {
				if(jaccard) {
					document.getElementById("rank_toggle").innerHTML = "Basic";
					jaccard = false;
				}
				else {
					document.getElementById("rank_toggle").innerHTML = "Jaccard distance";
					jaccard = true;					
				}
				do_search(false);
			}

		//Server-side, though shouldn't load database, but rather check via ajax that's it's loaded, and if not, load it			
			function initialise() {
				hide_database_panel();
				hide_query_panel();
				hide_display_panel();
				load_full_maws_database();
				console.log("Jaccard: "+jaccard);
				document.getElementById("rank_toggle").innerHTML = (!jaccard)? "Basic" : "Jaccard distance";
			}
