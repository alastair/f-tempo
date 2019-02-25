<?php
	ob_start('ob_gzhandler');
	$save_data = $_POST["trie_json"];
	echo "Result is ".substr($save_data,0,10000);
//	echo "Result is ".$save_data;
	$save_file = $_POST["json_db"];
	echo "\n\nTo be saved in ".$save_file;
?>