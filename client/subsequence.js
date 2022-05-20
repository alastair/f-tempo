import fetch from "node-fetch";

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error(`usage: ${process.argv[1]} [notes|intervals] [search-query] [collections-to-search] [num-results]`);
    console.error(`    quote the search query and separate items with a space`);
    console.error(`    e.g.     notes: "c4 a3 b3 c4 d4 c4"`);
    console.error(`         intervals: "B a a a A A"`);
    console.error(`    collections to search is comma separated: e.g. "cpdl" or "D-Bsb,GB-Lbl"`);
    process.exit();
}

const type = args[0];
const validTypes = ["notes", "intervals"];
if (!validTypes.includes(type)) {
    console.error("type must be 'notes' or 'intervals'");
    process.exit();
}

const intervals = type === "intervals";
const data = {interval: intervals, subsequence: args[1]};
const query_length = args[1].split(" ").length;

if (args.length > 2) {
    data.collections_to_search = args[2].split(",");
}

if (args.length > 3) {
    data.num_results = args[3];
}

fetch("https://solrdev.f-tempo.org/api/query_subsequence", {
    method: "POST",
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
}
).then(r => {
    return r.json();
}).then(data => {
    //console.log(data);
    processResults(data, intervals, query_length);
}).catch((error) => {
    console.error('Error:', error);
});

// \t${Number.parseFloat(row.jaccard).toFixed(2)}

function processResults(results, is_interval, query_length) {
    if (results.status === "ok") {
        results.data.results.forEach((row, index) => {
            console.log(`${index + 1}\t${row.id}`);
            if (row.part_number && row.part_name) {
                console.log(`\tPart ${row.part_name} (MEI part id ${row.part_number})`);
            }
            
            const codestring = is_interval ? row.codestring_intervals : row.codestring_notes;
            // Assume that the match positions are non-overlapping. Draw [ ... ] boxes around each match
            // and highlight them
            const matchPositions = row.matches.map(match => match.start_position);
            const reverseMatchPositions = [...matchPositions].reverse();
            reverseMatchPositions.forEach(m => {
                codestring.splice(m + query_length, 0, ']\x1b[0m');
                codestring.splice(m, 0, '\x1b[33m[');
            });
            console.log(`\t${row.num_matches} matches at ${matchPositions.join(", ")}`);
            console.log("\t" + codestring.join(" "));
            if (row.part_number && row.part_name) {
                matchPositions.forEach(m => {
                    console.log(`\thttps://solrdev.f-tempo.org/ngram/view/${row.id}?staff=${row.part_number}&start=${m}&count=${query_length}`);
                });
            }
            // Alternatively, print a line for each match, highlighting the section where it occurs
            // row.matches.forEach((match, matchindex) => {
            //     const matchCodestring = [...codestring];
            //     matchCodestring.splice(match.start_position + query_length, 0, ']\x1b[0m');
            //     matchCodestring.splice(match.start_position, 0, '\x1b[33m[');
            //     console.log(`\t${matchindex+1}. Starting at position ${match.start_position}`);
            //     console.log("\t" + matchCodestring.join(" "));
            // })
            console.log("");
        });
    } else if (results.status === "error") {
        console.error(`Error: ${results.error}`);
    }
}
