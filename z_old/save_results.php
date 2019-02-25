<?php

$reportString = $_POST["reportString"];
$dir = $_POST["dir"];
$filename = $_POST["filename"];

//echo "[in save_results.php] dir is ".$dir."\n";
//echo "filename is ".$filename."\n";
//echo "reportString starts ".substr($reportString,0,100)."\n";

$path = $dir.$filename;
//echo "Will save results to ".$path."\n";
 
if(!is_dir($dir)) {
	mkdir($dir);
}
chmod($dir,0777);

$save_file = fopen($path, "w");
if(fwrite($save_file, $reportString)) {
//	echo "Saved results to ".$path."\n";
}
else {
	echo "ERROR! Failed to save results to : ".$path."\n";
}
fclose($save_file);

?>