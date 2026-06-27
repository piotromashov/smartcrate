import Fastify from 'fastify';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({
    ok: true,
    discogsConfigured: Boolean(config.discogsToken),
    seeds: {
      labels: config.seeds.labels?.length ?? 0,
      artists: config.seeds.artists?.length ?? 0,
      releases: config.seeds.releases?.length ?? 0,
    },
  }));

  // Routes for the curation loop are registered in later groups (HTTP API).

  await app.listen({ port: config.port, host: '127.0.0.1' });
  app.log.info(`smartcrate backend on http://127.0.0.1:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
