#!/bin/bash
n=$(mktemp -u); FILEBASE=${n#*.}
WORKINGPATH=$(pwd)/users/${FILEBASE}
echo -n $WORKINGPATH
mkdir -p $WORKINGPATH 2> /dev/null
chmod a+rwx $WORKINGPATH
