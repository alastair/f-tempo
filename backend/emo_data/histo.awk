BEGIN {
	hist[-1]=0;
}
{
	if(substr($1,1,1)==">") next; 
	n=split($1,a,""); 
	for(i=1;i<=n;i++) {
		hist[a[i]]++;
	}
}
END {
	for(j in hist)
		{
		print j" "hist[j];
		}
}
