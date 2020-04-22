# EMO_search

### Current implementation

This version, running on a RISM server, currently _only_ searches ~500,000 pages from D-Mbs.
It will be augmented with the original F-TEMPO data (from D-Bsb, F-Pn, GB-Lbl and PL-Wn) shortly.

NB The Next/Previous Book commands do not currently work 

### Dependencies
```
Node.js
aruspix command line tools - https://github.com/DDMAL/aruspix/wiki/03-%E2%80%93-Aruspix-Command-line
imagemagick - https://www.imagemagick.org/
maw, with our modifications to the alphabet - https://github.com/ryaanahmed/maw
gawk - https://www.gnu.org/software/gawk/
```

To install, first...

```
npm install
mkdir run
```

To run...
```
node --max-old-space-size=8192 server.js Mbs0 Mbs1 Mbs2 Mbs3 Mbs4 Mbs5 Mbs6 Mbs7
```

The app listens at port 8020.

### TODO:
- Replace parse_mei_to_diat_int_str.awk with an actual parser for the MEI
