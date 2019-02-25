<?php
	$db_path = "http://doc.gold.ac.uk/~mas01tc/EMO_search/fast/emo_data/raw_lyrics/".$_GET['lid'].".hocr";
	echo $db_path;
	echo file_get_contents($db_path);
?>