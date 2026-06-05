import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma, type User } from '@manifest/db';
import {
  type LoginInput,
  type RegisterInput,
  loginSchema,
  registerSchema,
} from '@manifest/shared';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
const BCRYPT_COST = 12;

// A fixed hash to compare against when the email is unknown, so login response
// time does not reveal whether an account exists (anti-enumeration / timing).
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_COST);

export class AuthError extends Error {
  constructor(
    public readonly code: 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface PublicUser {
  id: string;
  email: string;
}
const toPublic = (u: User): PublicUser => ({ id: u.id, email: u.email });

/** Register a new account and start a session. */
export async function registerUser(
  raw: RegisterInput,
): Promise<{ user: PublicUser; token: string }> {
  const input = registerSchema.parse(raw);
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError('EMAIL_TAKEN', 'That email is already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const token = await createSession(user.id);
  return { user: toPublic(user), token };
}

/** Verify credentials and start a session. Generic error on any failure. */
export async function loginUser(raw: LoginInput): Promise<{ user: PublicUser; token: string }> {
  const input = loginSchema.parse(raw);
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a compare (dummy hash when the user is missing) so timing is
  // constant regardless of whether the email exists.
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await pruneExpired();
  const token = await createSession(user.id);
  return { user: toPublic(user), token };
}

/** Resolve the current user from a session token, enforcing expiry. */
export async function getUserBySessionToken(
  token: string | undefined | null,
): Promise<PublicUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
    return null;
  }
  return toPublic(session.user);
}

/** Destroy a session (logout). Safe to call with an unknown/empty token. */
export async function logout(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { id: token } });
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex'); // 256-bit opaque token
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  return token;
}

/** Opportunistic cleanup of expired sessions (no cron in this project). */
async function pruneExpired(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
