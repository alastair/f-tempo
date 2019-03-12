#!/bin/bash

# This is a dev version of the script that just cats out the final results
# for testing the system on a platform without aruspix or maws installed

IMG_FILE=$1
WORKINGPATH=$2;

cd $WORKINGPATH
cat "../data/dev_oneline.maw"
