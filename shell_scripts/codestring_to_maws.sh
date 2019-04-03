#!/bin/bash

QUERY_CODE=$1; # the diatonic interval string
WORKINGPATH=$2; 

#mkdir $WORKINGPATH
#chmod a+rwx $WORKINGPATH
old_dir=$(pwd)
cd $WORKINGPATH
echo "In working directory: "$WORKINGPATH >> log
echo "Query code is: "$QUERY_CODE >> log
page="query"

echo ">code query: " > page.txt
echo $QUERY_CODE >> page.txt
echo -n "Diat interval string (fasta): " >> log; 
cat page.txt >> log; 

name="code_query"
timestamp=`date --rfc-3339=seconds`
echo $timestamp": Generating MAWs for "$name":" >> log
maw -a 'PROT' -i page.txt -o $name".maw" -k 4 -K 8 2>> log
awk '{printf("%s ",$0)}' $name".maw" > $name"_oneline.maw" 
cat $name"_oneline.maw"
echo >> log
