#!/bin/bash

# takes a command line argument of the filename to process

IMG_FILE=$1
WORKINGPATH=$2;

cd $WORKINGPATH
echo "New working directory: "$WORKINGPATH >> log
echo $IMG_FILE >> log

page=$(basename $IMG_FILE)
cp $IMG_FILE ./$page

echo "Converted to tiff OK" >> log
echo "Passed through Aruspix OK" >> log
echo "Extracted MEI OK" >> log
echo -n "Diat interval string (fasta): " >> log; 
cat "temp_oneline.maw"
