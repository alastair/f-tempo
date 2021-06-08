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
import os
import subprocess
from typing import Dict, List

import pysolr


def chunks(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def save_computed_maws(maws: Dict[str, List[str]]):
    for siglum, maw_list in maws.items():
        cache_dir = os.path.join("cache", siglum.replace("_", "/"))
        os.makedirs(cache_dir, exist_ok=True)
        with open(os.path.join(cache_dir, "maws.json"), "w") as fp:
            json.dump(maw_list, fp)


def load_computed_maws(codestrings: Dict[str, str]) -> Dict[str, List[str]]:
    return_items = {}
    for siglum, codestring in codestrings.items():
        cache_dir = os.path.join("cache", siglum.replace("_", "/"))
        cache_file = os.path.join(cache_dir, "maws.json")
        if os.path.exists(cache_file):
            with open(cache_file) as fp:
                return_items[siglum] = json.load(fp)
    return return_items


def get_maws(codestrings: Dict[str, str], cache_maws: bool) -> Dict[str, List[str]]:
    #-a 'PROT' -i page.txt -o $name".maw" -k 4 -K 8

    if cache_maws:
        return_items = load_computed_maws(codestrings)
    else:
        return_items = {}
    missing_codestrings = {siglum: codestrings[siglum] for siglum in codestrings.keys() - return_items.keys()}

    parts = []
    for siglum, codestring in missing_codestrings.items():
        parts.append(">" + siglum + ":")
        parts.append(codestring)
    if parts:
        query = "\n".join(parts) + "\n"
        response = subprocess.run(["maw", "-a", "PROT", "-i", "-", "-o", "-", "-k", "4", "-K", "8"], input=query, text=True, capture_output=True)
        if "error" in response.stderr.lower():
            raise Exception("Unexpected error processing file: " + response.stderr)
        current_siglum = None
        for line in response.stdout.split():
            if not line:
                continue
            if line.startswith(">"):
                current_siglum = line.strip(">: ")
                return_items[current_siglum] = []
            else:
                return_items[current_siglum].append(line)

    if cache_maws:
        save_computed_maws(return_items)
    return return_items


def get_twograms(codestrings: Dict[str, str]) -> Dict[str, List[str]]:
    return_items = {}
    for siglum, codestring in codestrings.items():
        return_items[siglum] = list(chunks(codestring, 2))
    return return_items


def load_file(solr_host: str, cache_maws: bool, filename: str):
    solr = pysolr.Solr(solr_host, always_commit=True)

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
                submit(solr, cache_maws, documents)
                done += len(documents)
                documents = {}
                print(done)
    if documents:
        submit(solr, cache_maws, documents)


def submit(solr, cache_maws, documents):
    to_submit = []
    twograms = get_twograms(documents)
    maws = get_maws(documents, cache_maws)
    for siglum, codestring in documents.items():
        document = {"siglum": siglum, "maws": maws[siglum], "2grams": twograms[siglum], "codestring": codestring}
        to_submit.append(document)
    solr.add(to_submit, commit=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-h", help="solr host to connect to", default="http://localhost:8983/solr/ftempo/")
    parser.add_argument("-c", action="store_true", default=False, help="Store a cache of generated MAWs")
    parser.add_argument('codestringfile', help="file containing all codestrings to index")
    args = parser.parse_args()

    load_file(args.h, args.c, args.codestringfile)


if __name__ == '__main__':
    main()
