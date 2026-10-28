// scripts/resortConst.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONST_FILE = path.resolve(__dirname, '../src/reall3d/events/EventConstants.ts');

const raw = fs.readFileSync(CONST_FILE, 'utf8');
const lines = raw.split(/\r?\n/);

const headerLines = [];
const items = [];
let inHeader = true;
let pendingComment = null;

for (const line of lines) {
    const trimLine = line.trim();

    if (inHeader) {
        if (/^\s*\/\*\*.*?\*\/\s*$/.test(trimLine)) {
            inHeader = false;
            pendingComment = line;
            continue;
        }
        headerLines.push(line);
        continue;
    }

    if (trimLine === '') continue;

    if (/^\s*\/\*\*.*?\*\/\s*$/.test(trimLine)) {
        pendingComment = line;
        continue;
    }

    const m = line.match(/^\s*export const\s+(\w+)\s*=\s*i\+\+;/);
    if (m && pendingComment) {
        const name = m[1];
        items.push({
            name,
            full: [pendingComment, line],
        });
        pendingComment = null;
    }
}

items.sort((a, b) => a.name.localeCompare(b.name, 'en'));

const outLines = [...headerLines];
let count = 0;
for (const it of items) {
    outLines.push(...it.full);
    count++;
    if (count % 10 === 0) {
        outLines.push('');
    }
}

const output = outLines.join('\n');
fs.writeFileSync(CONST_FILE, output, 'utf8');

console.log(`✅ Done`);
