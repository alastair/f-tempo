<?php
$stout = [];
$result = exec("/isms/group/tmus/web-demo/do-absolutely_everything.sh ".$_FILES['page']['tmp_name']." 2>&1", $stout);
$out = "/isms/group/tmus/web-demo/".basename($_FILES['page']['tmp_name']).'/page.txt';
$origname=$_FILES['page']['name'];
$info = pathinfo($origname);
if(file_exists($out)){
    header('Content-Description: File Transfer');
    header('Content-Type: text/plain');
    header('Content-Disposition: attachment; filename="'.basename($origname, '.'.$info['extension']).'.txt"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($out));
    readfile($out);
  exit;
} else {
  echo "<pre>";
  echo "Problem! <br>";
  print_r([$result, $_FILES, $out, basename($_FILES['tmp_name']), $stout]);
  echo "</pre>";
}
?>
