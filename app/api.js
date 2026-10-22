// Schlanker Supabase-Client ohne Abhängigkeiten (Auth + REST via fetch).
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SESSION_KEY = 'uhc.session';

export const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

export class AuthError extends Error {}

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch { return {}; }
}

export function getUser() {
  if (!isConfigured()) return { email: 'demo', isAdmin: true, demo: true };
  const s = readSession();
  if (!s) return null;
  const claims = decodeJwt(s.access_token);
  return { email: claims.email, isAdmin: claims.app_metadata?.role === 'admin' };
}

async function tokenRequest(grantType, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.error_description || data.msg || 'Anmeldung fehlgeschlagen');
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  writeSession(session);
  return session;
}

export async function login(email, password) {
  await tokenRequest('password', { email, password });
  return getUser();
}

export function logout() {
  writeSession(null);
}

async function accessToken() {
  let s = readSession();
  if (!s) throw new AuthError('Nicht angemeldet');
  if (Date.now() > s.expires_at) {
    try {
      s = await tokenRequest('refresh_token', { refresh_token: s.refresh_token });
    } catch (e) {
      if (e instanceof AuthError) writeSession(null);
      throw e;
    }
  }
  return s.access_token;
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${await accessToken()}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { writeSession(null); throw new AuthError('Sitzung abgelaufen'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Fehler ${res.status}`);
  }
  // Upserts mit return=minimal liefern 201 ohne Inhalt
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const fetchAll = (table) => rest(`${table}?select=*`);

// Supabase Edge Function aufrufen (z.B. "import-games")
export async function invoke(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Fehler ${res.status}`);
  return data;
}

export const upsert = (table, rows) =>
  rest(`${table}?on_conflict=id`, {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
