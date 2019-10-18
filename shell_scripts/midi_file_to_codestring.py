import os
import string
import sys
import json

from music21 import chord
from music21 import interval
from music21 import midi
from music21 import stream


def open_midi_return_stream(path):
    mf = midi.MidiFile()
    mf.open(path)
    mf.read()
    mf.close()

    tracks = len(mf.tracks)
#    print(f'Midi file has {len(mf.tracks)} tracks')
#    print(mf.tracks[0])

    s = midi.translate.midiFileToStream(mf)
    parts = len(s.parts)
    # print(f'Stream has {len(s.parts)} parts')
    
    assert tracks - 1 == parts
    # s.show('text')
    return s


def part_to_codestring(part):
    s = stream.Stream()
    notes = list(part.notes)
    codestring = ''
    for i in range(len(notes) - 2):
        n_0 = notes[i]
        n_1 = notes[i+1]
        if isinstance(n_0, chord.Chord):
            n_0 = n_0[0]
        if isinstance(n_1, chord.Chord):
            n_1 = n_1[0]

        interval_obj = interval.notesToGeneric(n_0, n_1)
        interval_num = interval_obj.directed
        # print(interval_num)
        codestring += interval_to_codestring(interval_num)
    return codestring


def interval_to_codestring(interval_number):
    if interval_number == 1:
        return '-'
    elif interval_number > 1:
        return string.ascii_uppercase[interval_number - 2]
    else: # negative:
        return string.ascii_lowercase[-1 * interval_number - 2]


if __name__ == '__main__':
    codestrings_with_ids = []
    filename = sys.argv[1]
    try:
        s = open_midi_return_stream(filename)
    except:
        sys.exit()
    for i, part in enumerate(s):
        id = filename + '_' + str(i)
        cs = part_to_codestring(part)
        codestrings_with_ids.append(id + ' ' + cs)

    print(json.dumps(codestrings_with_ids, sort_keys=True, indent=1))
#    with open('codestrings.txt', 'w') as outfile:
#        for line in codestrings_with_ids:
#            outfile.write(line + '\n')


