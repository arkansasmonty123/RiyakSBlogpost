import { createApp } from './app.js';
import { closeDb, getDb } from './db/index.js';

getDb();
const PORT = Number(process.env.PORT || 3001);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[negotiation-table] server listening on http://localhost:${PORT}`);
});

function shutdown(): void {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
