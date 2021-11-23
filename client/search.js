import fetch from "node-fetch";

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error(`usage: ${process.argv[1]} [id|codestring] [search-query] [num-results]`);
    process.exit();
}

const type = args[0];
const validTypes = ["id", "codestring"];
if (!validTypes.includes(type)) {
    console.error("type must be 'id' or 'codestring'");
    process.exit();
}

const data = {};
if (type === "id") {
    data.id = args[1];
}
if (type === "codestring") {
    data.codestring = args[1];
}
if (args.length > 2) {
    data.num_results = args[2];
}

fetch("https://solrdev.f-tempo.org/api/query", {
    method: "POST",
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
}
).then(r => {
    return r.json();
}).then(data => {
    processResults(data);
}).catch((error) => {
    console.error('Error:', error);
});

function processResults(results) {
    if (results.status === "ok") {
        results.data.forEach((row, index) => {
            console.log(`${index + 1}\t${row.id}\t${Number.parseFloat(row.jaccard).toFixed(2)}`);
        });
    } else if (results.status === "error") {
        console.error(`Error: ${results.error}`);
    }
}
