#!/opt/local/bin/bash
FILEBASE=${1##*/}
WORKINGPATH=/isms/group/tmus/web-demo/${FILEBASE}
mkdir $WORKINGPATH
chmod a+rwx $WORKINGPATH
echo $WORKINGPATH
echo $PATH
cd $WORKINGPATH
cp $1 page.jpg
chmod a+rwx page.jpg
/opt/local/bin/convert page.jpg page.tiff
/usr/local/bin/aruspix-cmdline -m ../models page.tiff
unzip page.axz page.mei
