import fetch, {FormData, fileFromSync} from "node-fetch";
import fs from 'fs';

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error(`usage: ${process.argv[1]} [image-path]`);
    process.exit();
}

const imageData = fileFromSync(process.argv[2]);

const formData = new FormData();
formData.set('user_image_file', imageData);

fetch("https://solrdev.f-tempo.org/api/image_query", {
    method: "POST",
    body: formData
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
        results.data.results.forEach((row, index) => {
            console.log(`${index + 1}\t${row.id}\t${Number.parseFloat(row.jaccard).toFixed(2)}`);
        });
    } else if (results.status === "error") {
        console.error(`Error: ${results.error}`);
    }
}
