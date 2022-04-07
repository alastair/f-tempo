import fs from 'fs';
import os from 'os';
import path from 'path';

import yargs, { parse } from 'yargs'
import {hideBin} from 'yargs/helpers';

import { pageToContourList, parseMeiData } from '../lib/mei.js';
import { perform_omr_image } from './services/omr.js';

const argv = yargs(hideBin(process.argv)).usage('[file]')
    .command('* <file>', 'Perform OMR on an image').help().argv

if (argv) {
    omrFile(argv);
}

function omrFile(argv: any) {
    if (argv.file) {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omr'));
        const basename = path.basename(argv.file);
        fs.copyFileSync(argv.file, path.join(tmpDir, basename));

        const data = perform_omr_image(tmpDir, basename);

        const page = parseMeiData(data);
        const intervals = pageToContourList(page)
        console.log(`File: ${basename}`);
        console.log(intervals.join(""));
    } else {
        console.error("No arguments provided")
    }
}
