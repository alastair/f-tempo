# EMO_search

## Setup

### Automated setup with Docker
We have an automated process that will compile aruspix and the maw application using docker.
This doesn't require any manual configuration, but you do need to install Docker, which
on Mac can reduce performance. 

For Mac/Windows, install [docker desktop](https://www.docker.com/products/docker-desktop) or for 
linux install [docker engine](https://docs.docker.com/engine/install/ubuntu/).

To build the packages, run

    docker-compose build

To start the server (including the web server and solr) run

    docker-compose up

#### Configuration

The default setup assumes that your data is available in the current directory
in a subdirectory called `storage`. If this isn't the case, update the `docker-compose.yml`
file and modify the section

    volumes:
      - ./storage:/storage

so that the path before the `:` reflects the relative or absolute path of your storage directory.

#### Data files

To start up the server, you require the collection index files. These are json files, named by the library
where each collection comes from.
Download the files `/storage/ftempo/index-*.json` from the ftempo server and copy them to `./storage/ftempo`


#### Search index

Search in f-tempo is provided by solr. In order to use it you must first build a search index.
You can do this by building from scratch, or by copying an existing index.

**Build**

This requires the build `maw` exectuable to be in the `solr/` directory

    cd solr
    python -m venv env
    source env/bin/activate
    pip install -r requirements.txt
    
    python load_data.py -c ./storage/ftempo/locations/all/codestrings

The `-c` flag will _cache_ the output of the `maw` program so that if you run it again,
it will just load this cached data to the solr database instead of re-computing maws.
This can be useful if you want to make changes to the solr index but you know that the computed
maws remain the same.

The script assumes that your solr server is available on the standard location http://localhost:8983.
If it isn't, you can specify an option

    --host http://otherhost:8983/solr/core

TODO: Document how to run this inside of docker.

**Copy**

You can download the existing solr core from the f-tempo server (`/storage/ftempo/solr/data`)
and copy it as `./solr/data`. Then start the server. This will load the data
without needing to run the build process described above.

**Future work**

The build process currently uses a codestrings file. This should be updated to also
generate codestrings directly from an MEI file.

### Manual setup

#### Server

Requirements:

 * Node.js
 * aruspix command line tools - https://github.com/DDMAL/aruspix/wiki/03-%E2%80%93-Aruspix-Command-line
 * imagemagick - https://www.imagemagick.org/
 * maw, with our modifications to the alphabet - https://github.com/alastair/maw
 * gawk - https://www.gnu.org/software/gawk/

To install, first...

    npm install
    mkdir run


To run...

    npm run watch

The app listens at port 8000. Point your browser at localhost:8000

**TODO** Document how to run a small dataset.

#### Search index

You can download and run solr directly on your computer without using docker. You will require java.
Download the latest 8.x release from https://solr.apache.org/downloads.html and 
uncompress it.

**Build**
If you want to build your own solr index (see above), copy `./solr/cores/ftempo` to
`[uncompressed solr dir]/server/solr/` and follow the build instructions above.

**Copy**
Download the solr core from the f-tempo server (`/storage/ftempo/solr/data`)
and copy it as `[uncompressed solr dir]/server/solr/`
