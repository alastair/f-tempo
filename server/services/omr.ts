import cp from 'child_process';
import fs from 'fs';
import path from 'path';

export class NoSuchBinaryError extends Error {
    constructor(program: string) {
        super(`Program '${program}' doesn't exist`);
    }
}

export function perform_omr_image(workingDir: string, imageName: string) {
    const status = cp.spawnSync(
        "convert",
        [imageName, "-alpha", "off", "page.tiff"],
        {cwd: workingDir})
    if (status.status !== 0) {
        console.error("Error when running 'convert'");
        if ((status.error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new NoSuchBinaryError('convert');
        }
        console.error(status.stdout)
        console.error(status.stderr)
    }

    const aruspixStatus = cp.spawnSync(
        "aruspix-cmdline",
        ["-m", "/storage/ftempo/aruspix_models", "page.tiff"],
        {cwd: workingDir})
    if (aruspixStatus.status !== 0) {
        console.error("Error when running aruspix");
        console.error(aruspixStatus.stdout);
        console.error(aruspixStatus.stderr);
    }

    const zipStatus = cp.spawnSync(
        "unzip",
        ["-q", "page.axz", "page.mei"],
        {cwd: workingDir})
    if (zipStatus.status !== 0) {
        console.error("Error when uncompressing archive");
        console.error(zipStatus.stdout);
        console.error(zipStatus.stderr);
    }

        
    return fs.readFileSync(path.join(workingDir, 'page.mei'), 'utf-8');
}
