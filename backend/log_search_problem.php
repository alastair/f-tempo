<?php

$reportString = $_POST["reportString"];
// echo $reportString;

$search_prob_log_file = fopen("search_problem_log", "a");
if(fwrite($search_prob_log_file, $reportString."\n")) {
	echo "Logged: ".$reportString;
}
else {
	echo "ERROR! Failed to log: ".$reportString;
}
fclose($search_prob_log_file);

?>