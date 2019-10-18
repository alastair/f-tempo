#!/bin/bash

name=$1;
QUERY_CODE=$2; # the diatonic interval string
WORKINGPATH=$3 # the output directory; 

set -e # stop if anything errors

old_dir=$(pwd);
mkdir $WORKINGPATH 2> /dev/null;
cd $WORKINGPATH
echo "In working directory: "$WORKINGPATH >> log
echo "Query code is: "$QUERY_CODE >> log

echo ">code query: " > page.txt
echo $QUERY_CODE >> page.txt
echo -n "Diat interval string (fasta): " >> log
cat page.txt >> log; 

name="code_query"
timestamp=`date --rfc-3339=seconds`
echo $timestamp": Generating MAWs for "$name":" >> log
maw -a 'PROT' -i page.txt -o $name".maw" -k 4 -K 8 2>> log
awk '{printf("%s ",$0)}' $name".maw" > $name"_oneline.maw" 
cat $name"_oneline.maw"
echo >> log

cd $old_dir;
