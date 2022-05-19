type MeiNgram = {
    notes: Note[];
    contour: string[];
    sequence: number;
}

type Note = {
    p: string
    o: string
    id: string
    x?: string
}

type System = {
    id: string
    y?: string
    notes: Note[]
}

type Page = {
    label?: string
    partNumber?: string
    meiPath?: string
    width?: string
    height?: string
    systems: System[]
}