"""
Load codestrings from a datafile into solr.
Each line looks like this:
> D-Bsb_Parangon_10_1543_035_0 Ba--BaaaA-aaAaCdkCeDbD-bdFAbb--aAAAAAcd---P-caAcaaaaDhH
where the first element is the page siglum and the second is the extracted codestring

Split into the following fields:
  siglum
  codestring: the full codestring
  maws: a list of minimal absent words for this siglum generated from the codestring
  2grams: a list of 2-grams for this siglum generated from the codestring

Computing the maws involves calling an external program, so in order to speed up
subsequent executions, we cache the computed values in a folder hierarchy based on
the siglum (replacing _ with /)


"""

import argparse
import json
import subprocess
from typing import Dict, List

import pysolr

solr = pysolr.Solr('http://localhost:8983/solr/ftempo/', always_commit=True)


def chunks(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def get_maws(codestrings: Dict[str, str]) -> Dict[str, List[str]]:
    #-a 'PROT' -i page.txt -o $name".maw" -k 4 -K 8
    parts = []
    for siglum, codestring in codestrings.items():
        parts.append(">" + siglum + ":")
        parts.append(codestring)
    query = "\n".join(parts) + "\n"
    response = subprocess.run(["maw", "-a", "PROT", "-i", "-", "-o", "-", "-k", "4", "-K", "8"], input=query, text=True, capture_output=True)
    if "error" in response.stderr.lower():
        raise Exception("Unexpected error processing file: " + response.stderr)
    return_items = {}
    current_siglum = None
    for line in response.stdout.split():
        if not line:
            continue
        if line.startswith(">"):
            current_siglum = line.strip(">: ")
            return_items[current_siglum] = []
        else:
            return_items[current_siglum].append(line)

    return return_items


def get_twograms(codestrings: Dict[str, str]) -> Dict[str, List[str]]:
    return_items = {}
    for siglum, codestring in codestrings.items():
        return_items[siglum] = list(chunks(codestring, 2))
    return return_items


def load_file(filename):
    print(filename)

    documents = {}
    max_length = 1000
    done = 0
    with open(filename) as fp:
        for line in fp:
            if " " not in line.strip():
                continue
            siglum, codestring = line.strip().split()
            documents[siglum] = codestring
            if len(documents) >= max_length:
                submit(documents)
                done += len(documents)
                documents = {}
                print(done)
    if documents:
        submit(documents)


def submit(documents):
    to_submit = []
    twograms = get_twograms(documents)
    maws = get_maws(documents)
    for siglum, codestring in documents.items():
        document = {"siglum": siglum, "maws": maws[siglum], "2grams": twograms[siglum], "codestring": codestring}
        to_submit.append(document)
    solr.add(to_submit, commit=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('codestringfile', help="file containing all codestrings to index")
    args = parser.parse_args()

    load_file(args.codestringfile)


if __name__ == '__main__':
    main()
