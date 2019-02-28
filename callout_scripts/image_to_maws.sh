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

convert $1 -alpha off page.tiff 2>> log
echo "Converted to tiff OK" >> log

aruspix-cmdline -m ../run/ page.tiff 2>> log
echo "Passed through Aruspix OK" >> log

unzip -q page.axz page.mei 2>> log
echo "Extracted MEI OK" >> log

echo ">"$1 > page.txt
gawk -f ./parse_mei_to_diat_int_str.awk page.mei >> page.txt

echo -n "Diat interval string (fasta): " >> log; 
cat page.txt >> log; 

file=$1
name=$(basename ${file%.*})
timestamp=`date --rfc-3339=seconds`

echo $timestamp": Generating MAWs for "$1":" >> log
maw -a 'PROT' -i page.txt -o $name".maw" -k 4 -K 8 2>> log
awk '{printf("%s ",$0)}' $name".maw" > $name"_oneline.maw" 
cat $name"_oneline.maw"

echo >> log
echo
cd $old_dir
