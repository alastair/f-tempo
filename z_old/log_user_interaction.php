<?php

$reportString = $_POST["reportString"];
// echo $reportString;

$user_log_file = fopen("user_log", "a");
if(fwrite($user_log_file, $reportString."\n")) {
	echo "Logged: ".$reportString;
}
else {
	echo "ERROR! Failed to log: ".$reportString;
}
fclose($user_log_file);

?>