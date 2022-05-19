/// <reference types="./types" />
import fs from 'fs';
import path from "path";
import {JSDOM} from 'jsdom';

/**
 * Parse an MEI document converted from MusicXML by verovio, containing
 * multiple parts
 * @param filename
 * @returns
 */
export function parseMeiParts(meiRoot: string, filename: string) {
    const fullFilename = path.join(meiRoot, filename);
    const data = fs.readFileSync( fullFilename, 'utf-8');
    const dom = new JSDOM("")
    const DOMParser = dom.window.DOMParser;
    const parser = new DOMParser();
    const document = parser.parseFromString(data, "application/xml");


    const staffDefinitions = document.getElementsByTagName("staffDef");
    // We store an object of {staffid: staffdata} so that we can map between the staffdefs
    // and the actual staffs. TODO: Perhaps better to instead get a list of staffdef numbers
    // and then loop through them and pick out only the relevant staffs of music
    const staffs: {[k: string]: Page} = {};
    Array.from(staffDefinitions).forEach(function(sd) {
        const attributes = sd.attributes;
        const label = sd.getElementsByTagName("label");
        let staffLabel;
        if (label.length) {
            // Remove leading/trailing whitespace, and collapse all runs of whitespace to a single space
            staffLabel = label[0].textContent!.trim().replace(/\s/g, ' ').replace(/\s\s+/g, ' ');
        }
        const n: string = attributes.getNamedItem('n')?.value!
        if (n) {
            staffs[n] = {
                label: staffLabel,
                partNumber: n,
                meiPath: filename,
                systems: [{id: `system-${n}`, notes: []}]
            };
        }
    });

    const measures = document.getElementsByTagName("measure");
    Array.from(measures).forEach(function(measure) {
        const measureStaffs = measure.getElementsByTagName("staff");
        Array.from(measureStaffs).forEach(function(staff) {
            const measureStaffId = staff.attributes.getNamedItem('n')?.value!
            const notes = staff.getElementsByTagName("note");
            Array.from(notes).forEach(function(note) {
                const nattrs = note.attributes;
                const p = nattrs.getNamedItem('pname')?.value!
                const o  = nattrs.getNamedItem('oct')?.value!
                const id = nattrs.getNamedItem('xml:id')?.value!
                staffs[measureStaffId].systems[0].notes.push({id, p, o});
            });
        });
    });

    return Object.entries(staffs).map(([key, value]) => {
        return value;
    })
}

export function parseMeiFile(meiRoot: string, filename: string): Page {
    const fullFilename = path.join(meiRoot, filename);
    const data = fs.readFileSync( fullFilename, 'utf-8');
    return parseMeiData(data, filename);
}

export function parseMeiData(data: string, filename: string): Page {
    const dom = new JSDOM("")
    const DOMParser = dom.window.DOMParser;
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "application/xml");
    return parseMeiDocument(doc, filename);
}

/**
 * Parse an MEI document transcribed by Aruspix
 * @param document
 * @param filename
 * @returns
 */
function parseMeiDocument(document: Document, filename: string): Page {
    const systemElements = document.getElementsByTagName("system");

    const systems = Array.from(systemElements).map(function(system): System {
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
        meiPath: filename,
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

export function notesToContour(notes: Note[], chunkSize?: number) {
    if (!chunkSize) {
        chunkSize = 4;
    }
    const nGrams: MeiNgram[] = [];
    for (let i = 0; i < notes.length - chunkSize + 1; i++) {
        const part = notes.slice(i, i + chunkSize);
        const contour = pitchesToIntervalMapping(part);
        const ngram: MeiNgram = {
            contour: contour,
            notes: part,
            sequence: i
        };
        nGrams.push(ngram);
    }
    return nGrams;
}

/**
 * Take an array of pitches (objects with key pitch (letter) and oct (number))
 * and return a mapping of absolute pitches differences between the notes
 * - if there is no change
 * a for pitch 1, b for pitch 2, c for pitch 3. Upper-case if pitch is increasing,
 * lower-case if pitch is decreasing. Doesn't take into account accidentals
 * @param pitches
 */
export function pitchesToIntervalMapping(pitches: Note[]): string[] {
    const interval_mapping = '-abcdefghijklmnopqrstuvwxyz'.split('');

    const alphabet = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    const pitch_nums = pitches.map(function(e) {
        return alphabet.indexOf(e.p.toUpperCase()) + (7 * parseInt(e.o, 10));
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
