# Convert diatonic interval string ($1) into fasta format, extract MAWs, and save on single line

rm page.txt 2> /dev/null
echo ">code" > "page.txt";
echo $1 | awk '{
	for(i=1;i<=NF;i++) {
		print $i >> "page.txt"
	}
}'
rm "out.maw"
maw -a 'PROT' -i page.txt -o "out.maw" -k 4 -K 8 ;
awk '{if(NR==1) printf("%s ",substr($0,2)); else printf("%s ",$0)}' "out.maw"  

