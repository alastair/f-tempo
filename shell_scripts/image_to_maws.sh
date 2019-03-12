#!/bin/bash

# takes a command line argument of the filename to process

IMG_FILE=$1
WORKINGPATH=$2;

cd $WORKINGPATH
echo "New working directory: "$WORKINGPATH >> log
echo $IMG_FILE >> log

convert $IMG_FILE -alpha off page.tiff 2>> log
echo "Converted to tiff OK" >> log

aruspix-cmdline -m ../data/aruspix_models page.tiff 2>> log
echo "Passed through Aruspix OK" >> log

unzip -q page.axz page.mei 2>> log
echo "Extracted MEI OK" >> log

echo ">"$IMG_FILE > page.txt
gawk -f ../shell_scripts/parse_mei_to_diat_int_str.awk page.mei >> page.txt

echo -n "Diat interval string (fasta): " >> log; 
cat page.txt >> log; 

basename=$(basename ${IMG_FILE%.*})
timestamp=`date --rfc-3339=seconds`

echo $timestamp": Generating MAWs for "$IMG_FILE":" >> log
maw -a 'PROT' -i page.txt -o $basename".maw" -k 4 -K 8 2>> log
awk '{printf("%s ",$0)}' $basename".maw" > $basename"_oneline.maw" 
cat $basename"_oneline.maw"

rm -r *

echo >> log
echo
