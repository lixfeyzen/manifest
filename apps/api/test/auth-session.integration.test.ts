import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { buildServer } from '../src/server.js';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { authCookie, resetAndSeed } from './helpers.js';

describe('auth session edge cases (REST integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await fulfillmentQueue.close();
    await redisConnection.quit();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetAndSeed();
  });

  function getMe(cookie: string) {
    return app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie },
    });
  }

  it('rejects an expired session and prunes the expired row', async () => {
    // authCookie registers a fresh user via the real route, creating exactly one
    // session. The signed cookie's value is the session id (the opaque token).
    const cookie = await authCookie(app);

    const session = await prisma.session.findFirst();
    expect(session).not.toBeNull();

    // Force the session into the past directly in the DB.
    await prisma.session.update({
      where: { id: session!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await getMe(cookie);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ user: null });

    // getUserBySessionToken prunes the expired row on access.
    const after = await prisma.session.findUnique({ where: { id: session!.id } });
    expect(after).toBeNull();
  });

  it('invalidates the session on logout', async () => {
    const cookie = await authCookie(app);

    const before = await prisma.session.findFirst();
    expect(before).not.toBeNull();

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toEqual({ ok: true });

    // The session row is gone...
    const after = await prisma.session.findUnique({ where: { id: before!.id } });
    expect(after).toBeNull();

    // ...and the same cookie can no longer authenticate.
    const meRes = await getMe(cookie);
    expect(meRes.statusCode).toBe(401);
    expect(meRes.json()).toEqual({ user: null });
  });

  it('rejects an unknown/garbage sid cookie', async () => {
    const res = await getMe('sid=not-a-real-signed-cookie-value');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ user: null });
  });
});
