import cp from "child_process";
import nconf from "nconf";

/**
 * Get maws for an object of codestrings
 * @param codestrings an object of id: codestring mappings
 * @returns an object of id: [list of maws]
 */
export function get_maws_for_codestrings(codestrings: {[k: string]: string}): {[k: string]: string[]} {
    if (Object.keys(codestrings).length > 100) {
        console.warn(`Warning: Getting maws for more than 100 items at once can be buggy`)
    }
    const inputArray = Object.entries(codestrings).map(([id, codestring]) => {
        return `>${id}:\n${codestring}`;
    });
    const inputstr = inputArray.join("\n") + "\n";
    const maws = cp.spawnSync(
        nconf.get('config:maw_path'),
        ["-a", "PROT", "-i", "-", "-o", "-", "-k", "4", "-K", "8"],
        {input: inputstr}
    );
    if (maws === undefined) {
        throw new Error("Cannot find `maw` binary");
    }
    // Output consists of >id on one line and then a maw on each subsequent line until the next >id line
    const maws_output = maws.stdout.toString();
    const output: {[k: string]: string[]} = {}
    let currentKey: string = '';
    for (const line of maws_output.split("\n")) {
        if (line.startsWith(">")) {
            currentKey = line.replaceAll(">", "").replaceAll(":", "");
            output[currentKey] = []
        } else {
            if (line) {
                output[currentKey].push(line);
            }
        }
    }
    return output;
}