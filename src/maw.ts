import cp from "child_process";
import nconf from "nconf";

export async function get_maws_for_codestring(codestring: string): Promise<string[] | undefined> {
    return new Promise((resolve, reject)=> {
        const inputstr = `>input:\n${codestring}\n`;
        const maws = cp.spawnSync(
            nconf.get('config:maw_path'),
            ["-a", "PROT", "-i", "-", "-o", "-", "-k", "4", "-K", "8"],
            {input: inputstr});
        if (maws === undefined) {
            reject(Error("Cannot find `maw` binary"))
        }
        const maws_output = maws.stdout.toString().split("\n");
        // Remove any empty lines and the first sentinel line that starts with >
        resolve(maws_output.filter((val: string) => val && !val.startsWith(">")));
    })
}