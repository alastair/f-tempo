# EMO_search

### Current implementation


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
node --max-old-space-size=8192 server.js test
```
(The 'test' argument is necessary for local testing. To do this, you must expand 'test_data.zip' to a directory two levels above 'f-tempo' (see server.js lines 162/3)

The app listens at port 8000. Point your browser at localhost:8000

### TODO:
- Replace parse_mei_to_diat_int_str.awk with an actual parser for the MEI
