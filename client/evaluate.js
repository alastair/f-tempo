/*
Evaluate different ranking metrics for search queries
Usage:
   evaluate.js QUERYTYPE RANKTYPE QUERY NUMRESULTS
Where:
   querytype:  one of id, codestring, maws
   ranktype:   choose from boolean, solr, jaccard, legacy. List many separated by comma without a space
               e.g. solr,legacy
               use 'all' for all of them
   query:      the search query. A document ID for type 'id', a codestring without spaces for 'codestring'
               or space separated maws for type 'maws' (quote this argument)
   numresults: how many rows to return for each (optional, default 10)


   evaluate.js id solr,jaccard GB-Lbl_A103b_025_0 10
*/


const args = process.argv.slice(2);
if (args.length < 3) {
    console.error(`usage: ${process.argv[1]} QUERYTYPE RANKTYPE QUERY NUMRESULTS`);
    console.error(`       QUERYTYPE: id, codestring, or maws`);
    console.error(`        RANKTYPE: boolean, solr, jaccard, legacy`);
    process.exit();
}

const type = args[0];
const validTypes = ["id", "codestring", "maws"];
if (!validTypes.includes(type)) {
    console.error(`QUERYTYPE must be one of ${validTypes.join(", ")}`);
    process.exit();
}

const rank = args[1];
const validRanks = ["boolean", "solr", "jaccard", "legacy", "all"];
let rankParts = rank.split(",");
for (const rp of rankParts) {
    if (!validRanks.includes(rp)) {
        console.error(`RANKTYPE must be from ${validRanks.join(", ")}, comma-separated`);
        process.exit();
    }
}

if (rank === "all") {
    rankParts = ["boolean", "solr", "jaccard", "legacy"];
}

const data = {};
const query = args[2];
if (type === "id") {
    data.id = args[2];
} else if (type === "codestring") {
    data.codestring = args[2];
} else if (type === "maws") {
    data.maws = args[2];
}
if (args.length > 3) {
    data.num_results = args[3];
}

(async function() {
    for (let rankPart of rankParts) {
        let url;
        if (rankPart === "legacy") {
            url = "https://search.f-tempo.org/api/query";
        } else {
            url = "https://solrdev.f-tempo.org/api/query";
        }

        data.similarity_type = rankPart;

        const {default: fetch} = await import("node-fetch");
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            const j = await response.json();
            processResults(j, query, rankPart);

    }
})();

function processResults(results, query, simType) {
    // Results from old server are different to the new one, so rewrite the response
    if (simType === "legacy") {
        results = {status: "ok", data: results};
    }
    if (results.status === "ok") {
        console.log(`Search query: ${query}`);
        console.log(`Ranking method: ${simType}`);
        results.data.forEach((row, index) => {
            let score;
            if (simType === 'jaccard' || simType === 'legacy') {
                score = row.jaccard;
            } else {
                score = row.score;
            }
            console.log(`  ${index + 1}\t${row.id}\t${Number.parseFloat(score).toFixed(2)}`);
        });
    } else if (results.status === "error") {
        console.error(`Error: ${results.error}`);
    }
}
