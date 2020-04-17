for i in ../data/D-Mbs_lists/*; 
  do 
   grep -H $1 $i;
  done  |  awk '{  if(!length($0)) next;    split($0,a,":");    n=split(a[1],b,"/");     if(b[n]!="all") print b[n];  }'
