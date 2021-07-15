import fs from "fs";
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

type Note = {
    pname: string;
    oct: string;
}

type MeiNeume = {
    note: Note;
    ulx?: string;
    uly?: string;
    xmlid: string;
    system: string;
}

type MeiNgram = {
    notes: Note[];
    contour: string[];
    sequence: number;
    file: string;
    // TODO: Bounding boxes
}

function parseMei(filename: string): MeiNeume[] {
    const data = fs.readFileSync( filename, 'utf-8');
    const dom = new JSDOM("")
    const DOMParser = dom.window.DOMParser;
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "application/xml");
    return parseMeiDocument(doc);
}

function parseMeiDocument(document: Document) {
    const notes = document.getElementsByTagName("note");
    return Array.from(notes).map(function(note): MeiNeume {
        const system = note.closest("system");
        const sysAttrs = system?.attributes
        const systemLy = sysAttrs?.getNamedItem("uly")?.value;
        const nattrs = note.attributes;
        return {
            note: {
                pname: nattrs.getNamedItem('pname')?.value!,
                oct: nattrs.getNamedItem('oct')?.value!,
            },
            xmlid: nattrs.getNamedItem('xml:id')?.value!,
            system: sysAttrs?.getNamedItem("xml:id")?.value!,
            ulx: nattrs.getNamedItem('ulx')?.value,
            uly: systemLy
        }
    });
}

function main(filename: string) {
    const notes = parseMei(filename);
    const chunkSize = 4;
    const nGrams: MeiNgram[] = [];
    for (let i = 0; i < notes.length - chunkSize + 1; i++) {
        const part = notes.slice(i, i + chunkSize);
        const partNotes = part.map((x)=>x.note);
        const contour = pitchesToIntervalMapping(partNotes);
        const ngram: MeiNgram = {
            contour: contour,
            notes: partNotes,
            sequence: i,
            file: filename
        }
        nGrams.push(ngram)
    }
    console.log(JSON.stringify(nGrams));
}

/**
 * Take an array of pitches (objects with key pitch (letter) and oct (number))
 * and return a mapping of absolute pitches differences between the notes
 * - if there is no change
 * a for pitch 1, b for pitch 2, c for pitch 3. Upper-case if pitch is increasing,
 * lower-case if pitch is decreasing. Doesn't take in to account accidentals
 * @param pitches
 */
function pitchesToIntervalMapping(pitches: Note[]) {
    const interval_mapping = '-abcdefghijklmnopqrstuvwxyz'.split('');

    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    const pitch_nums = pitches.map(function(e) {
        // TODO: This replicates the behaviour of the awk script, where g is 0 and a->f is 1-6
        //  appears to be a bug because of awk string indexes starting from 1
        return (alphabet.indexOf(e.pname.toUpperCase()) + 1) % 7 + ((7 * parseInt(e.oct, 10)) % 7);
    });

    let pitch_intervals = [];
    // Finish one before the end, because we're looking at the gaps
    for (let i = 0; i < pitch_nums.length - 1; i++) {
        pitch_intervals.push(pitch_nums[i + 1] - pitch_nums[i]);
    }
    return pitch_intervals.map(function(i) {
        // Clamp to a maximum interval of 25 notes
        if (i < -26) i = -26;
        if (i > 26) i = 26;
        let letter = interval_mapping[Math.abs(i)];
        if (i > 0) {
            letter = letter.toUpperCase();
        }
        return letter;
    });
}


if (require.main === module) {
    main(process.argv[2]);
}