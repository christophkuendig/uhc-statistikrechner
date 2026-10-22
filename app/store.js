// Offline-first Datenspeicher: alles liegt lokal im Browser und wird
// im Hintergrund mit Supabase abgeglichen, sobald Netz da ist.
import * as api from './api.js';

const DATA_KEY = 'uhc.data';
const DIRTY_KEY = 'uhc.dirty';

// Spalten je Tabelle – Supabase verlangt bei Sammel-Upserts identische Felder.
const COLUMNS = {
  players: ['id', 'name', 'number', 'position', 'active', 'deleted', 'updated_at'],
  matches: ['id', 'date', 'opponent', 'home', 'season', 'roster', 'lines', 'notes', 'deleted', 'updated_at'],
  events: ['id', 'match_id', 'type', 'period', 'game_time', 'scorer_id', 'assist_id', 'on_ice',
    'player_id', 'penalty', 'deleted', 'created_at', 'updated_at'],
};
const TABLES = Object.keys(COLUMNS); // Reihenfolge wichtig: Events brauchen ihr Match

const DEFAULTS = {
  players: { number: null, position: 'S', active: true },
  matches: { home: true, roster: [], lines: [], notes: null },
  events: { period: null, game_time: null, scorer_id: null, assist_id: null, on_ice: [], player_id: null, penalty: null },
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

let data = load(DATA_KEY, { players: {}, matches: {}, events: {} });
let dirty = new Set(load(DIRTY_KEY, []));
let status = { state: 'idle', message: '', lastSync: null };
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
  } catch {}
}

function emit() { listeners.forEach((fn) => fn()); }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// crypto.randomUUID gibt es nur über HTTPS – ohne Zertifikat (z.B. frische
// eigene Domain) die UUID v4 selbst aus getRandomValues bauen.
export const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

function normalize(table, row) {
  const out = {};
  for (const col of COLUMNS[table]) {
    out[col] = row[col] ?? DEFAULTS[table][col] ?? (col === 'deleted' ? false : null);
  }
  return out;
}

export function get(table, id) {
  const row = data[table][id];
  return row && !row.deleted ? row : null;
}

export function list(table, filter) {
  const rows = Object.values(data[table]).filter((r) => !r.deleted);
  return filter ? rows.filter(filter) : rows;
}

export function save(table, row) {
  const now = new Date().toISOString();
  const full = normalize(table, {
    ...data[table][row.id],
    ...row,
    id: row.id || uuid(),
    created_at: row.created_at || data[table][row.id]?.created_at || now,
    updated_at: now,
  });
  data = { ...data, [table]: { ...data[table], [full.id]: full } };
  // Im Demo-Modus nichts zum Hochladen vormerken – Testdaten sollen nie in Supabase landen
  if (api.isConfigured()) dirty.add(`${table}:${full.id}`);
  persist();
  emit();
  scheduleSync();
  return full;
}

export function remove(table, id) {
  if (data[table][id]) save(table, { ...data[table][id], deleted: true });
}

export const getStatus = () => ({ ...status, pending: dirty.size });

function setStatus(patch) {
  status = { ...status, ...patch };
  emit();
}

let syncing = false;
let syncTimer = null;

export function scheduleSync(delay = 500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, delay);
}

export async function sync() {
  if (!api.isConfigured() || !api.getUser() || syncing) return;
  if (!navigator.onLine) return setStatus({ state: 'offline', message: 'Offline – wird später übertragen' });

  syncing = true;
  setStatus({ state: 'syncing', message: '' });
  const errors = [];
  try {
    // 1) Lokale Änderungen hochladen
    for (const table of TABLES) {
      const keys = [...dirty].filter((k) => k.startsWith(`${table}:`));
      if (!keys.length) continue;
      const rows = keys.map((k) => data[table][k.slice(table.length + 1)]).filter(Boolean);
      const snapshot = new Map(rows.map((r) => [r.id, r.updated_at]));
      try {
        await api.upsert(table, rows);
        for (const [id, updated] of snapshot) {
          // Nur als erledigt markieren, wenn inzwischen nicht erneut geändert
          if (data[table][id]?.updated_at === updated) dirty.delete(`${table}:${id}`);
        }
      } catch (e) {
        if (e instanceof api.AuthError) throw e;
        errors.push(`${table}: ${e.message}`);
      }
    }
    persist();

    // 2) Stand vom Server holen (Datenmenge ist klein → alles laden)
    const next = { ...data };
    for (const table of TABLES) {
      const rows = await api.fetchAll(table);
      const merged = {};
      for (const row of rows) merged[row.id] = row;
      // Noch nicht hochgeladene lokale Änderungen behalten
      for (const key of dirty) {
        if (key.startsWith(`${table}:`)) {
          const id = key.slice(table.length + 1);
          if (data[table][id]) merged[id] = data[table][id];
        }
      }
      next[table] = merged;
    }
    data = next;
    persist();
    setStatus(errors.length
      ? { state: 'error', message: errors.join(' · ') }
      : { state: 'idle', message: '', lastSync: new Date().toISOString() });
  } catch (e) {
    if (e instanceof api.AuthError) setStatus({ state: 'auth', message: 'Bitte neu anmelden' });
    else setStatus({ state: 'offline', message: 'Keine Verbindung – wird später übertragen' });
  } finally {
    syncing = false;
  }
}

// Beim Wiederverbinden und regelmässig abgleichen
window.addEventListener('online', () => scheduleSync(0));
setInterval(() => sync(), 60_000);
