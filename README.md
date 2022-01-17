# EMO_search

## Setup

### Automated setup with Docker
We have an automated process that will compile aruspix and the maw application using docker.
This doesn't require any manual configuration, but you do need to install Docker, which
can reduce performance on Macs.

For Mac/Windows, install [docker desktop](https://www.docker.com/products/docker-desktop) or for 
linux install [docker engine](https://docs.docker.com/engine/install/ubuntu/).

To build the packages, run

    docker-compose build

#### Configuration

Create a file `.env` in this directory with the following contents:

```
FTEMPO_SOLR_DATA_DIR=/mnt/ftempo/solr-data
FTEMPO_STORAGE_DIR=/mnt/ftempo
FTEMPO_CONFIG=config/default_config.json
```

`FTEMPO_SOLR_DATA_DIR` is the path to the location where the solr index will be stored. If you copy the index from
another server, indicate the path here. This directory should have the following files and directories in it:
`filestore/ ftempo/ solr.xml  userfiles/ zoo.cfg`

`FTEMPO_STORAGE_DIR` is the path to the location where the F-Tempo data files (images, MEI, etc) are stored.
This directory must include a `locations/` subdirectory containing images and MEI

#### Data files

To start up the server, you require the collection index files. These are json files, named by the library
where each collection comes from.
Download the files `/storage/ftempo/index-*.json` from the ftempo server and copy them to `${FTEMPO_STORAGE_DIR}`

#### Search database

See the "Search index" section below to configure search server

#### Startup

To start the server (including the web server and solr) run

    docker-compose up

### Search index

Search in f-tempo is provided by solr. In order to use it you must first build a search index.
You can do this by building from scratch, or by copying an existing index.

#### Copy

You can download the existing solr core from the f-tempo server (`/storage/ftempo/solr/data`)
and copy it as `./solr/data`. Then start the server. This will load the data
without needing to run the build process described above.

#### Build

First, start the solr server:

    docker-compose up -d solr

Or use the `bin/solr` script in a manually installed version

This requires the path to a `maw` executable to be set in the config file at `config:maw_path`.
Be careful to set this correctly if you are not running in docker

In docker, to start a shell run

    docker-compose run --rm ftempo bash

And then to import an index file, run

    node --loader ts-node/esm server/mei_to_solr.ts import /storage/ftempo/index-D-Mbs.json

The MEI files for each corpus need to be available at `/storage/ftempo/locations/{LIBRARY}/mei/`

**Future work**

The build process currently uses a codestrings file. This should be updated to also
generate codestrings directly from an MEI file.

### Manual setup

#### Server

##### Requirements:

 * Node.js
 * aruspix command line tools - https://github.com/DDMAL/aruspix/wiki/03-%E2%80%93-Aruspix-Command-line
 * imagemagick - https://www.imagemagick.org/
 * maw, with our modifications to the alphabet - https://github.com/alastair/maw
 * gawk - https://www.gnu.org/software/gawk/

##### Installation

To install node dependencies, run 

    npm install

##### Startup

To run the server

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
