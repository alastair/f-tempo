# echo $1
python3 midi_file_to_codestring.py $1 | 
awk '{gsub(/[\[\",]/,"");print $2; print ""}'

