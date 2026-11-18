const fs = require('node:fs');
const path = require('node:path');
const { zipSync, unzipSync } = require('fflate');
const root = path.resolve(__dirname, '..');
const files = {};
const excludedDirectories = new Set(['node_modules', '.git', '.local-mongodb', 'dist', 'coverage']);
function add(relative) {
  const file = path.join(root, relative);
  if (fs.statSync(file).isDirectory()) {
    if (excludedDirectories.has(path.basename(file))) return;
    for (const name of fs.readdirSync(file)) add(path.join(relative, name));
  } else files[relative.split(path.sep).join('/')] = new Uint8Array(fs.readFileSync(file));
}
for (const relative of ['.env', '.gitignore', 'README.md', 'ASSIGNMENT.md', 'package.json', 'package-lock.json', 'vite.config.mjs', 'backend', 'frontend', 'tests', 'scripts', 'images']) add(relative);
if (Object.keys(files).some(name => /(^|\/)(node_modules|\.git|\.local-mongodb|dist|coverage)(\/|$)/.test(name))) throw new Error('Excluded directory found in submission.');
const output = zipSync(files, { level: 6 });
if (!unzipSync(output)['.env']) throw new Error('Submission is missing .env.');
const destination = path.join(root, 'Homework1-submission.zip');
fs.writeFileSync(destination, output);
console.log(`Created ${destination} (${Object.keys(files).length} files). Includes .env; excludes node_modules.`);
