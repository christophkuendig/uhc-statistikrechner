// Gemeinsame UI-Bausteine
import { html } from '../vendor/preact-htm.module.js';
import * as store from './store.js';
import { isConfigured } from './api.js';

export const navigate = (hash) => { location.hash = hash; };

export const byNumber = (a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name);

export const playerLabel = (p) => (p ? `${p.number != null ? `#${p.number} ` : ''}${p.name}` : 'Unbekannt');

export const playerById = (id) => (id ? store.get('players', id) : null);

export const formatDate = (d) =>
  new Date(d).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

export const today = () => new Date().toISOString().slice(0, 10);

// Raster mit grossen Spieler-Buttons
export function PlayerGrid({ players, selected, onPick, empty = 'Keine Spieler' }) {
  const isSel = (id) => (selected instanceof Set ? selected.has(id) : selected === id);
  if (!players.length) return html`<p class="muted">${empty}</p>`;
  return html`
    <div class="player-grid">
      ${players.map((p) => html`
        <button type="button" class=${`player-btn ${isSel(p.id) ? 'selected' : ''}`} onClick=${() => onPick(p.id)}>
          <span class="num">${p.number ?? '–'}</span>
          <span class="name">${p.name}</span>
        </button>`)}
    </div>`;
}

// Bottom-Sheet für mehrstufige Eingaben
export function Sheet({ title, onClose, children, footer }) {
  return html`
    <div class="sheet-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label=${title}>
        <header class="sheet-head">
          <h2>${title}</h2>
          <button type="button" class="icon-btn" aria-label="Schliessen" onClick=${onClose}>✕</button>
        </header>
        <div class="sheet-body">${children}</div>
        ${footer && html`<footer class="sheet-foot">${footer}</footer>`}
      </div>
    </div>`;
}

export function SyncBadge() {
  if (!isConfigured()) return html`<span class="sync">Demo</span>`;
  const s = store.getStatus();
  const label = {
    syncing: 'Synchronisiere…',
    offline: s.pending ? `Offline · ${s.pending} ausstehend` : 'Offline',
    error: 'Sync-Fehler',
    auth: 'Neu anmelden',
    idle: s.pending ? `${s.pending} ausstehend` : 'Gespeichert',
  }[s.state];
  return html`<span class=${`sync sync-${s.pending && s.state === 'idle' ? 'pending' : s.state}`} title=${s.message}>${label}</span>`;
}
