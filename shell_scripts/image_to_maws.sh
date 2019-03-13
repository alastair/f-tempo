#!/bin/bash

# takes a command line argument of the filename to process

IMG_FILE=$1
WORKINGPATH=$2;

set -e # stop if anything errors

# Setup working location
cd $WORKINGPATH
echo "New working directory: "$WORKINGPATH >> log
echo $IMG_FILE >> log


# Convert the input image to tiff, removing alpha channel
convert $IMG_FILE -alpha off page.tiff 2>> log
echo "Converted to tiff OK" >> log


# Run Aruspix on the converted image
aruspix-cmdline -m ../../../data/aruspix_models page.tiff 2>> log
echo "Passed through Aruspix OK" >> log

# Extract things we need from the Aruspix output
unzip -q page.axz page.mei 2>> log
echo "Extracted MEI OK" >> log

# Parse MEI into diatonic interval string
echo ">"$IMG_FILE > page.txt
gawk -f ../../../shell_scripts/parse_mei_to_diat_int_str.awk page.mei >> page.txt
echo -n "Diat interval string (fasta): " >> log; 
cat page.txt >> log; 


# Generate maws and return that out
basename=$(basename ${IMG_FILE%.*})
timestamp=`date --rfc-3339=seconds`
echo $timestamp": Generating MAWs for "$IMG_FILE":" >> log
maw -a 'PROT' -i page.txt -o $basename".maw" -k 4 -K 8 2>> log
awk '{printf("%s ",$0)}' $basename".maw" > $basename"_oneline.maw" 
cat $basename"_oneline.maw"
