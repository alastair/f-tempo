import fs from 'fs';
import {JSDOM} from 'jsdom';

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
        const systemId = sysAttrs?.getNamedItem("xml:id")?.value!
        const noteElements = system.getElementsByTagName("note");
        const notes = Array.from(noteElements).map(function(note): Note {
            const nattrs = note.attributes;
            return {
                p: nattrs.getNamedItem('pname')?.value!,
                o: nattrs.getNamedItem('oct')?.value!,
                id: nattrs.getNamedItem('xml:id')?.value!,
                x: nattrs.getNamedItem('ulx')?.value!
            };
        });

        return {
            id: systemId,
            notes: notes,
            y: sysAttrs.getNamedItem('uly')?.value!
        };
    });

    const pageElements = document.getElementsByTagName("page");
    // TODO: If this file has more than 1 page?
    const page = Array.from(pageElements);
    if (page.length > 1) {
        throw Error("Can't deal with more than 1 page");
    }
    const pageAttrs = page[0]?.attributes!;

    return {
        width: pageAttrs.getNamedItem('page.width')?.value!,
        height: pageAttrs.getNamedItem('page.height')?.value!,
        systems: systems
    };
}

/**
 * Take a page and return a list of all notes on this page in the form:
 * [a4, b4, f4, g3]
 * @param page
 */
export function pageToNoteList(page: Page): string[] {
    const notes = page.systems.map((s) => {
        return s.notes.map(n => {
            return `${n.p}${n.o}`;
        });
    });
    return notes.flat();
}

/**
 * Take a page and return a list of all contours on this page in the form:
 * [A, B, A, -, a, a, b]
 * @param page
 */
export function pageToContourList(page: Page): string[] {
    const notes = page.systems.map((s) => {
        return s.notes;
    });
    return pitchesToIntervalMapping(notes.flat());
}

export function listToNgrams(items: string[], chunkSize?: number) {
    if (!chunkSize) {
        chunkSize = 4;
    }
    const ngrams = [];
    for (let i = 0; i < items.length - chunkSize + 1; i++) {
        const part = items.slice(i, i + chunkSize);
        ngrams.push(part.join());
    }
    return ngrams;
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
            notes: part,
            sequence: i
        };
        nGrams.push(ngram);
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

