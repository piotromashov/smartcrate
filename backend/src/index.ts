import { loadConfig } from './config';
import { openDb } from './db/db';
import { sqliteCache } from './discogs/cache';
import { DiscogsClient } from './discogs/client';
import { DownloadWorker } from './downloads/worker';
import { buildApp } from './app';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.dbPath);

  // Discogs client only when a token is configured; recommend endpoint is
  // otherwise disabled (returns 503) rather than failing at startup.
  const client = config.discogsToken
    ? new DiscogsClient({ token: config.discogsToken, cache: sqliteCache(db) })
    : null;

  const worker = new DownloadWorker(db, config);
  worker.start();

  const app = buildApp({ db, config, client });
  await app.listen({ port: config.port, host: '127.0.0.1' });
  app.log.info(
    `smartcrate backend on http://127.0.0.1:${config.port} (discogs: ${client ? 'on' : 'off'})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
