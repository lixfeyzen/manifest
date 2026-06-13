import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema, registerSchema } from '@manifest/shared';
import { env } from '../env.js';
import {
  AuthError,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  getUserBySessionToken,
  loginUser,
  logout,
  registerUser,
} from '../services/auth-service.js';

const isProd = env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  // The web and API can be deployed on different sites; a cross-site credentialed
  // request only carries the cookie with SameSite=None (which requires Secure). In
  // dev we stay on Lax over http, where None+Secure is impossible. (See ADR 004.)
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  path: '/',
  signed: true,
  maxAge: SESSION_TTL_SECONDS,
};

/** Read and verify the session token from the signed `sid` cookie. */
export function readSessionToken(req: FastifyRequest): string | null {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

function setSession(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, cookieOptions);
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Single-operator console: account provisioning is seed/dev only. The public
  // registration route is disabled in production, so the deployed app has no signup.
  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      if (env.NODE_ENV === 'production') {
        return reply.status(404).send({ error: 'Not found' });
      }
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
      }
      try {
        const { user, token } = await registerUser(parsed.data);
        setSession(reply, token);
        return reply.status(201).send({ user });
      } catch (error) {
        if (error instanceof AuthError && error.code === 'EMAIL_TAKEN') {
          return reply.status(409).send({ error: error.message });
        }
        req.log.error({ err: error }, 'register failed');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input' });
      }
      try {
        const { user, token } = await loginUser(parsed.data);
        setSession(reply, token);
        return reply.status(200).send({ user });
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.status(401).send({ error: error.message });
        }
        req.log.error({ err: error }, 'login failed');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  app.post('/auth/logout', async (req, reply) => {
    await logout(readSessionToken(req));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(200).send({ ok: true });
  });

  app.get('/auth/me', async (req, reply) => {
    const user = await getUserBySessionToken(readSessionToken(req));
    if (!user) {
      return reply.status(401).send({ user: null });
    }
    return reply.status(200).send({ user });
  });
};
