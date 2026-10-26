import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase';

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = 'morrow_session';
export const OTP_LIFETIME_MS = 10 * 60 * 1000;
export const OTP_RESEND_DELAY_MS = 60 * 1000;

export type AuthUser = {
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
};

export type PendingSignup = {
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
};

export async function getAuthUser(email: string): Promise<AuthUser | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('store_users')
    .select('name,email,password_salt,password_hash,created_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name,
    email: data.email,
    passwordSalt: data.password_salt,
    passwordHash: data.password_hash,
    createdAt: data.created_at,
  };
}

export async function listAuthUsers(): Promise<Pick<AuthUser, 'name' | 'email' | 'createdAt'>[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('store_users')
    .select('name,email,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((user) => ({
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  }));
}

export async function createAuthUser(user: AuthUser): Promise<void> {
  const { error } = await getSupabaseAdmin().from('store_users').insert({
    email: user.email,
    name: user.name,
    password_salt: user.passwordSalt,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
  });
  if (error) throw error;
}

export async function updateAuthUser(
  email: string,
  updates: { name?: string; email?: string; passwordSalt?: string; passwordHash?: string },
): Promise<boolean> {
  const values: Record<string, string> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.email !== undefined) values.email = updates.email;
  if (updates.passwordSalt !== undefined) values.password_salt = updates.passwordSalt;
  if (updates.passwordHash !== undefined) values.password_hash = updates.passwordHash;
  const { data, error } = await getSupabaseAdmin()
    .from('store_users')
    .update(values)
    .eq('email', email)
    .select('email')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function deleteAuthUser(email: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('store_users')
    .delete()
    .eq('email', email)
    .select('email')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function getPendingSignup(email: string): Promise<PendingSignup | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('pending_signups')
    .select('name,email,password_salt,password_hash,code_hash,expires_at,last_sent_at,attempts')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name,
    email: data.email,
    passwordSalt: data.password_salt,
    passwordHash: data.password_hash,
    codeHash: data.code_hash,
    expiresAt: Date.parse(data.expires_at),
    lastSentAt: Date.parse(data.last_sent_at),
    attempts: data.attempts,
  };
}

export async function savePendingSignup(signup: PendingSignup): Promise<void> {
  const { error } = await getSupabaseAdmin().from('pending_signups').upsert(
    {
      email: signup.email,
      name: signup.name,
      password_salt: signup.passwordSalt,
      password_hash: signup.passwordHash,
      code_hash: signup.codeHash,
      expires_at: new Date(signup.expiresAt).toISOString(),
      last_sent_at: new Date(signup.lastSentAt).toISOString(),
      attempts: signup.attempts,
    },
    { onConflict: 'email' },
  );
  if (error) throw error;
}

export async function deletePendingSignup(email: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from('pending_signups').delete().eq('email', email);
  if (error) throw error;
}

export async function completeSignup(email: string, code: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc('complete_signup', {
    p_email: email,
    p_code_hash: hashOtp(code),
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Supabase returned an invalid signup result.');
  return data;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return { salt, hash: hash.toString('hex') };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function createOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function otpMatches(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to a value at least 32 characters long.');
  }
  return secret;
}

export function createSessionToken(email: string, role: 'user' | 'admin' = 'user'): string {
  const payload = Buffer.from(
    JSON.stringify({ email, role, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
  ).toString('base64url');
  const signature = createHmac('sha256', authSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSessionClaims(
  token: string | undefined,
): { email: string; role: 'user' | 'admin' } | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  const expectedSignature = createHmac('sha256', authSecret())
    .update(payload)
    .digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof value === 'object' &&
      value !== null &&
      'email' in value &&
      typeof value.email === 'string' &&
      'expiresAt' in value &&
      typeof value.expiresAt === 'number' &&
      value.expiresAt > Date.now()
    ) {
      const role = 'role' in value && value.role === 'admin' ? 'admin' : 'user';
      return { email: value.email, role };
    }
  } catch {
    return null;
  }

  return null;
}

export function readSessionToken(token: string | undefined): string | null {
  return readSessionClaims(token)?.email ?? null;
}

export function readAdminSessionToken(token: string | undefined): string | null {
  const claims = readSessionClaims(token);
  return claims?.role === 'admin' ? claims.email : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export async function sendSignupCode(email: string, name: string, code: string) {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!user || !password || !from) {
    throw new Error('SMTP_USER, SMTP_PASS, and SMTP_FROM or SMTP_USER must be configured.');
  }

  const port = Number(process.env.SMTP_PORT || '465');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your Morrow Studio verification code',
    text: `Hi ${name}, your Morrow Studio sign-up code is ${code}. It expires in 10 minutes.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your Morrow Studio sign-up code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
  });
}
