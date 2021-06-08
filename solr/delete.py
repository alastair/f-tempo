import argparse

import pysolr

solr = pysolr.Solr('http://localhost:8983/solr/ftempo/', always_commit=True)

def main():
    solr.delete(q="*:*")


if __name__ == '__main__':
    main()
