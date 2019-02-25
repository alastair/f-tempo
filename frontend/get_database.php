<?php
	$db_path = "emo_data/databases/".$_GET['database'];
	echo file_get_contents($db_path);
?>