const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const projectRoot = path.resolve(__dirname, '..');
const dataDirectory = path.join(projectRoot, '.local-mongodb');
let executable = 'mongod';
if (process.platform === 'win32') {
  const directory = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
  if (fs.existsSync(directory)) {
    const versions = fs.readdirSync(directory).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const installed = versions.map(version => path.join(directory, version, 'bin', 'mongod.exe')).find(file => fs.existsSync(file));
    if (installed) executable = installed;
  }
}
fs.mkdirSync(dataDirectory, { recursive: true });
console.log('Starting MongoDB at 127.0.0.1:27017. Leave this terminal open; Ctrl+C stops it.');
// Lightweight local development settings. Journaling remains enabled and the
// installed MongoDB service configuration is never changed by this script.
const child = spawn(executable, [
  '--dbpath', dataDirectory, '--bind_ip', '127.0.0.1', '--port', '27017',
  '--logpath', path.join(dataDirectory, 'mongod.log'), '--logappend',
  '--wiredTigerEngineConfigString', 'log=(file_max=1MB,prealloc=false)',
  '--wiredTigerCacheSizeGB', '0.25', '--setParameter', 'indexBuildMinAvailableDiskSpaceMB=16'
], { stdio: 'inherit', windowsHide: true });
child.on('error', error => {
  console.error(`Unable to start MongoDB: ${error.message}. Install MongoDB Community Edition and put mongod on PATH.`);
  process.exitCode = 1;
});
child.on('exit', code => { process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
