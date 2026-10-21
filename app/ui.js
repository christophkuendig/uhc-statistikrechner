// Gemeinsame UI-Bausteine
import { html } from '../vendor/preact-htm.module.js';
import * as store from './store.js';
import { isConfigured } from './api.js';

export const navigate = (hash) => { location.hash = hash; };

export const byNumber = (a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name);

export const playerLabel = (p) => (p ? `${p.number != null ? `#${p.number} ` : ''}${p.name}` : 'Unbekannt');

export const playerById = (id) => (id ? store.get('players', id) : null);

// Schweizer Kurzformat: «Sa 25.10.» bzw. «Sa 25.10.2025»
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const formatDate = (d, withYear = false) => {
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${withYear ? date.getFullYear() : ''}`;
};

export const today = () => new Date().toISOString().slice(0, 10);

// Linien-Icons (stroke 1.8, runde Enden, ohne Füllung)
const ICONS = {
  matches: 'M4 7h16M4 12h16M4 17h10',
  stats: 'M5 20V11M12 20V4M19 20v-6',
  roster: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.8.6 3 2.4 3 5.2',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
};
export const Icon = ({ name }) => html`
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;

// Seitenkopf als Flutlicht-Bühne: eine Zeile chrom, eine Zeile outline
export function PageHead({ eyebrow, title, outline, digit, extra, children }) {
  return html`
    <header class="stage pagehead">
      ${digit != null && html`<span class="ghost-digit" aria-hidden="true">${digit}</span>`}
      <div class="wrap">
        ${eyebrow && html`<p class="eyebrow">${eyebrow}</p>`}
        <h1 class="d"><span class="chrome">${title}</span>${outline && html`<span class="outline">${outline}</span>`}</h1>
        ${children && html`<div class="head-actions">${children}</div>`}
        ${extra}
      </div>
    </header>`;
}

// Sektionskopf: Eyebrow + Display-H2, rechts optional Zähler oder Link
export function SecHead({ eyebrow, title, aside }) {
  return html`
    <div class="sec-head">
      <div>${eyebrow && html`<p class="eyebrow">${eyebrow}</p>`}<h2 class="d">${title}</h2></div>
      ${aside}
    </div>`;
}

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
          <h2 class="d">${title}</h2>
          <button type="button" class="icon-btn" aria-label="Schliessen" onClick=${onClose}><${Icon} name="close" /></button>
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
  return html`<span class=${`sync sync-${s.pending && s.state === 'idle' ? 'pending' : s.state}`} title=${s.message} role="status">${label}</span>`;
}
