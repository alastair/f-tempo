type MeiNgram = {
    notes: Note[];
    contour: string[];
    sequence: number;
}

type Note = {
    p: string
    o: string
    id: string
    x: string
}

type System = {
    id: string
    y: string
    notes: Note[]
}

type Page = {
    width: string
    height: string
    systems: System[]
}