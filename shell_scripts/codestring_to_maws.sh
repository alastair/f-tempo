#!/bin/bash
# n=$(mktemp -u); FILEBASE=${n#*.}
# WORKINGPATH=$(pwd)/${FILEBASE}
# the path has been set elsewhere; $1 is code, $2 is the path where it will be saved
WORKINGPATH=$2;
#mkdir $WORKINGPATH
#chmod a+rwx $WORKINGPATH
old_dir=$(pwd)
cd $WORKINGPATH
echo "In working directory: "$WORKINGPATH >> log
echo "Query code is: "$1 >> log
page="query"

echo ">code query: " > page.txt
echo $1 >> page.txt
echo -n "Diat interval string (fasta): " >> log; 
cat page.txt >> log; 

name="code_query"
timestamp=`date --rfc-3339=seconds`
echo $timestamp": Generating MAWs for "$name":" >> log
maw -a 'PROT' -i page.txt -o $name".maw" -k 4 -K 8 2>> log
awk '{printf("%s ",$0)}' $name".maw" > $name"_oneline.maw" 
cat $name"_oneline.maw"
echo >> log
