import * as fs from 'fs';
import * as path from 'path';

const srcFile1 = './src/reall3d/modeldata/worker/SetupWorkerFetch.ts';
const bakFile1 = './pkg/SetupWorkerFetch.ts';
const srcFile2 = './src/reall3d/modeldata/worker/SetupWorkerLod.ts';
const bakFile2 = './pkg/SetupWorkerLod.ts';
const srcFile3 = './src/reall3d/modeldata/worker/SetupWorkerSort.ts';
const bakFile3 = './pkg/SetupWorkerSort.ts';
const assetsDir = './pkg/dist/assets';
const descFile = './pkg/dist/pkg.d.ts';
const faviconFile = './pkg/dist/favicon.ico';

if (process.argv.length > 2) {
    process.argv[2] === '--before' && beforeBuildPkg();
    process.argv[2] === '--after' && afterBuildPkg();
}

function afterBuildPkg() {
    fixDescFile(); // 修复 .d.ts
    write(srcFile1, read(bakFile1)); // 从备份文件中恢复
    write(srcFile2, read(bakFile2)); // 从备份文件中恢复
    write(srcFile3, read(bakFile3)); // 从备份文件中恢复
    fs.unlinkSync(faviconFile); // 删除多余文件
    fs.unlinkSync(bakFile1); // 删除备份文件
    fs.unlinkSync(bakFile2); // 删除备份文件
    fs.unlinkSync(bakFile3); // 删除备份文件
}

function fixDescFile() {
    const lines = read(descFile).split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('declare interface')) {
            lines[i] = 'export ' + lines[i];
        }
    }
    write(descFile, lines.join('\n'));
}

function beforeBuildPkg() {
    buildBase64ByFileName(srcFile1, bakFile1, 'WorkerFetch');
    buildBase64ByFileName(srcFile2, bakFile2, 'WorkerLod');
    buildBase64ByFileName(srcFile3, bakFile3, 'WorkerSort');
}

function buildBase64ByFileName(srcFile, bakFile, name) {
    write(bakFile, read(srcFile));

    const tgtFile = findTargetFile(assetsDir, name);
    const base64String = fs.readFileSync(tgtFile).toString('base64');

    const devLines = read(srcFile).split('\n');
    const pkgLines = [];
    for (let i = 0; i < devLines.length; i++) {
        if (devLines[i].includes(`new URL('./${name}.ts', import.meta.url)`)) {
            pkgLines.push(`    const WkBase64 = '';` + '\r');
            pkgLines.push(`    const workerUrl = URL.createObjectURL(new Blob([atob(WkBase64)], { type: 'text/javascript' }));` + '\r');
            pkgLines.push(`    const worker = new Worker(new URL(workerUrl, import.meta.url), { type: 'module' });` + '\r');
        } else {
            pkgLines.push(devLines[i]);
        }
    }
    for (let i = 0; i < pkgLines.length; i++) {
        if (pkgLines[i].includes('const WkBase64 =')) {
            if (pkgLines[i].trim() === 'const WkBase64 =') {
                pkgLines[i + 1] = `        '${base64String}';` + '\r';
            } else {
                pkgLines[i] = `    const WkBase64 = '${base64String}';` + '\r';
            }
        }
    }
    write(srcFile, pkgLines.join('\n'));
}

function read(file, encoding = 'utf-8') {
    return fs.readFileSync(file, encoding);
}

function write(file, text = '', encoding = 'utf-8') {
    fs.writeFileSync(file, text, encoding);
}

function findTargetFile(directoryPath, name = 'WorkerFetch') {
    const files = fs.readdirSync(directoryPath);
    const tgtFiles = files.filter(file => file.startsWith(name) && file.endsWith('.js'));
    return path.join(directoryPath, tgtFiles[0]);
}
