str=$1;
m=$2;
echo -n ">code query: "
strlen=${#str}
a=$(($strlen-$m)); 
for a in $(seq 0 $a); 
	do echo -n ${str:$a:$m}" "; done
echo
