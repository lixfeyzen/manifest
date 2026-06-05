import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@manifest/db';
import { fulfillmentQueue, redisConnection } from '../src/queue.js';
import { buildServer } from '../src/server.js';
import { resetAndSeed } from './helpers.js';

describe('auth (REST integration)', () => {
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

  const post = (url: string, body: unknown, cookie?: string) =>
    app.inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      payload: JSON.stringify(body),
    });

  const cookieOf = (res: { headers: Record<string, unknown> }) => {
    const sc = res.headers['set-cookie'];
    const raw = Array.isArray(sc) ? sc[0]! : (sc as string);
    return raw.split(';')[0]!;
  };

  it('registers a user with a hashed password and sets a session cookie', async () => {
    const res = await post('/auth/register', { email: 'a@example.com', password: 'password123' });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.email).toBe('a@example.com');
    expect(res.headers['set-cookie']).toBeTruthy();

    const user = await prisma.user.findUnique({ where: { email: 'a@example.com' } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe('password123'); // hashed, never plaintext
  });

  it('rejects a duplicate email with 409', async () => {
    await post('/auth/register', { email: 'dup@example.com', password: 'password123' });
    const res = await post('/auth/register', { email: 'dup@example.com', password: 'password123' });
    expect(res.statusCode).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong password with a generic 401', async () => {
    await post('/auth/register', { email: 'b@example.com', password: 'password123' });

    const ok = await post('/auth/login', { email: 'b@example.com', password: 'password123' });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['set-cookie']).toBeTruthy();

    const bad = await post('/auth/login', { email: 'b@example.com', password: 'wrongpass' });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error).toBe('Invalid email or password');

    // Unknown email returns the SAME generic error (no user enumeration).
    const unknown = await post('/auth/login', { email: 'nope@example.com', password: 'whatever' });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error).toBe('Invalid email or password');
  });

  it('returns the current user from /auth/me with a valid cookie', async () => {
    const reg = await post('/auth/register', { email: 'c@example.com', password: 'password123' });
    const cookie = cookieOf(reg);

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('c@example.com');

    const anon = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(anon.statusCode).toBe(401);
  });

  it('guards /graphql: 401 without a session, 200 with one', async () => {
    const query = JSON.stringify({ query: '{ dashboardMetrics { totalOrders } }' });

    const unauth = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: query,
    });
    expect(unauth.statusCode).toBe(401);

    const reg = await post('/auth/register', { email: 'd@example.com', password: 'password123' });
    const cookie = cookieOf(reg);
    const authed = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json', cookie },
      payload: query,
    });
    expect(authed.statusCode).toBe(200);
    expect(authed.json().data.dashboardMetrics).toBeTruthy();
  });
});
