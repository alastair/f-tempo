#!/bin/bash

# takes a single command line argument of path to a jpeg file to process

#IMG_FILE=$(basename $1);
#WORKINGDIR=$(dirname $1);
#dirname=$WORKINGDIR"/"${IMG_FILE%.jpg};
#mkdir $dirname 2> /dev/null
#WORKINGPATH=$dirname;

HOME_DIR=$(pwd);

IMG_FILE=$1
WORKINGPATH=$2;

set -e # stop if anything errors

# Setup working location
cd $WORKINGPATH
echo "New working directory: "$WORKINGPATH >> log
echo $IMG_FILE >> log


# Convert the input image to tiff, removing alpha channel
convert $IMG_FILE -alpha off page.tiff 2>> log
#convert ../$IMG_FILE -alpha off page.tiff 2>> log
echo "Converted to tiff OK" >> log


# Run Aruspix on the converted image
#aruspix-cmdline -m ~/emo_search/data/aruspix_models page.tiff 2>> log
aruspix-cmdline -m /storage/ftempo/aruspix_models page.tiff 2>> log
echo "Passed through Aruspix OK" >> log

# delete page.mei if it exists, as unzip needs interaction if it does
# rm page.mei 2> /dev/null
# Extract things we need from the Aruspix output
unzip -q page.axz page.mei 2>> log
echo "Extracted MEI OK" >> log

# Parse MEI into diatonic interval string
#echo -n $IMG_FILE" " > page.txt
#touch page.txt;
gawk -f /app/shell_scripts/parse_mei_to_diat_int_str.awk page.mei | tr -d "\n" > page.txt
echo -n "Diat interval string (oneline): " >> log; 
cat page.txt >> log; 

# return the codestring
head -n 1 page.txt

cd $HOME_DIR;

