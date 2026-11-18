const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { openDatabase } = require('./database.cjs');
const { createApp } = require('./app.cjs');

async function start() {
  const database = await openDatabase(process.env.MONGODB_URI);
  const port = Number(process.env.PORT) || 3000;
  const server = createApp(database).listen(port, '127.0.0.1', () => {
    console.log(`Connected to local MongoDB. Open http://localhost:${server.address().port}`);
  });
  server.on('error', async error => {
    console.error(`Unable to start HTTP server: ${error.message}`);
    await database.connection.close();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(async () => { await database.connection.close(); process.exit(0); });
  });
}
start().catch(error => {
  console.error(`Startup failed: ${error.message}`);
  console.error('Check MONGODB_URI in .env and start MongoDB Community Edition locally.');
  process.exitCode = 1;
});
