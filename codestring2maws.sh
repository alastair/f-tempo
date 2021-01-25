# Convert diatonic interval string ($1) into fasta format, extract MAWs, and save on single line

echo ">code" > page.txt;
awk '{
	for(i=1;i<=NF;i++) {
		print("%s",$i) >> page.txt
	}
}' $1
maw -a 'PROT' -i page.txt -o "out.maw" -k 4 -K 8 ;
awk '{if(NR==1) printf("%s ",substr($0,2)); else printf("%s ",$0)}' "out.maw"  

