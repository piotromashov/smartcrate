import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db/db';
import type { Config } from './config';
import type { DiscogsClient } from './discogs/client';
import { getQueue } from './recommender/queue';
import { generateExploreQueue } from './recommender/recommend';
import { listDownloads } from './downloads/queue';
import { currentPlayable } from './playable';
import { applyRating, type RateAction } from './service';

export interface AppDeps {
  db: Db;
  config: Config;
  /** Discogs client, or null when no token is configured (recommend disabled). */
  client: DiscogsClient | null;
}

const RATE_ACTIONS: RateAction[] = ['like', 'dislike', 'skip'];

export function buildApp(deps: AppDeps): FastifyInstance {
  const { db, config, client } = deps;
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true, discogsConfigured: Boolean(client) }));

  // Current track + full explore queue.
  app.get('/api/queue', async () => ({
    current: currentPlayable(db),
    queue: getQueue(db),
  }));

  app.get('/api/current', async () => currentPlayable(db));

  // Rate the current/given track: like | dislike | skip.
  app.post('/api/tracks/:trackId/rate', async (req, reply) => {
    const { trackId } = req.params as { trackId: string };
    const value = (req.body as { value?: string } | undefined)?.value;
    if (!value || !RATE_ACTIONS.includes(value as RateAction)) {
      return reply.code(400).send({ error: `value must be one of ${RATE_ACTIONS.join(', ')}` });
    }
    try {
      return { current: applyRating(db, config, trackId, value as RateAction) };
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });

  // Trigger recommendation generation to (re)fill the explore queue.
  app.post('/api/recommend', async (_req, reply) => {
    if (!client) {
      return reply
        .code(503)
        .send({ error: 'DISCOGS_TOKEN is not configured; recommendation is unavailable.' });
    }
    return generateExploreQueue(db, client, config);
  });

  app.get('/api/downloads', async () => listDownloads(db));

  app.get('/api/seeds', async () => config.seeds);

  return app;
}
