#!/bin/bash
# n=$(mktemp -u); FILEBASE=${n#*.}
# WORKINGPATH=$(pwd)/${FILEBASE}
# the path has been set elsewhere; $1 is filename, $2 is the path where it will be saved

WORKINGPATH=$2;

old_dir=$(pwd)

cd $WORKINGPATH
echo "New working directory: "$WORKINGPATH >> log
echo $1 >> log

page=$(basename $1)
cp $1 ./$page
#chmod a+rwx page.jpg
convert $1 page.tiff 2>> log
echo "Converted to tiff OK" >> log

aruspix-cmdline -m /home/mas01tc/emo_search/server_client/models/ page.tiff 2>> log
echo "Passed through Aruspix OK" >> log

unzip -q page.axz page.mei 2>> log
echo "Extracted MEI OK" >> log
echo ">"$1 > page.txt

gawk -f /home/mas01tc/emo_search/scripts/parse_mei_to_diat_int_str.awk page.mei >> page.txt
echo -n "Diat interval string (fasta): " >> log; 

cat page.txt >> log; 
file=$1
name=$(basename ${file%.*})
timestamp=`date --rfc-3339=seconds`
echo $timestamp": Generating ngrams for "$1":" >> log

int_str=$(cat page.txt | tail -n 1)
echo "int_str: "$int_str

/home/mas01tc/emo_search/web-demo/str2ngram.sh  $int_str $3 > $name"_oneline_ngrams.txt" 2>> log;
cat $name"_oneline_ngrams.txt"
echo >> log
echo

cd $old_dir
