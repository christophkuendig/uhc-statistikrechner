// Saisonstatistik mit sortierbarer Tabelle und CSV-Export für Excel
import { html, useState } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { playerStats, seasonOf, teamSummary } from '../stats.js';
import { TEAM_NAME } from '../config.js';
import { PageHead, SecHead, today } from '../ui.js';

const COLUMNS = [
  { key: 'number', label: '#', get: (r) => r.player.number ?? 999, asc: true },
  { key: 'name', label: 'Spieler', get: (r) => r.player.name, asc: true },
  { key: 'gp', label: 'Sp', title: 'Spiele' },
  { key: 'goals', label: 'T', title: 'Tore' },
  { key: 'assists', label: 'A', title: 'Assists' },
  { key: 'points', label: 'P', title: 'Punkte' },
  { key: 'plusMinus', label: '+/−', title: 'Plus/Minus' },
  { key: 'pim', label: 'SM', title: 'Strafminuten' },
];
const value = (col, r) => (col.get ? col.get(r) : r[col.key]);
const fmtPm = (n) => (n > 0 ? `+${n}` : String(n));

export function StatsTable({ rows, showGp = true }) {
  const [sort, setSort] = useState({ key: 'points', dir: -1 });
  const cols = COLUMNS.filter((c) => showGp || c.key !== 'gp');
  const col = cols.find((c) => c.key === sort.key) || cols[0];
  const sorted = [...rows].sort((a, b) => {
    const va = value(col, a), vb = value(col, b);
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return cmp * sort.dir || b.points - a.points || b.goals - a.goals || a.player.name.localeCompare(b.player.name);
  });

  function sortBy(c) {
    setSort(sort.key === c.key ? { key: c.key, dir: -sort.dir } : { key: c.key, dir: c.asc ? 1 : -1 });
  }

  if (!rows.length) return html`<p class="muted">Keine Daten.</p>`;
  return html`
    <div class="table-wrap card">
      <table class="stats">
        <thead><tr>
          ${cols.map((c) => html`
            <th title=${c.title} class=${`${c.key === 'name' ? 'left' : ''} ${c.key === sort.key ? 'sorted' : ''}`}
              onClick=${() => sortBy(c)}>${c.label}${c.key === sort.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`)}
        </tr></thead>
        <tbody>
          ${sorted.map((r) => html`
            <tr>
              <td class="rank">${r.player.number ?? ''}</td>
              <td class="left name">${r.player.name}</td>
              ${showGp && html`<td>${r.gp}</td>`}
              <td>${r.goals}</td>
              <td>${r.assists}</td>
              <td class="pts">${r.points}</td>
              <td class=${r.plusMinus < 0 ? 'neg' : ''}>${fmtPm(r.plusMinus)}</td>
              <td>${r.pim}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>`;
}

function exportCsv(season, rows) {
  const header = ['Nr', 'Spieler', 'Position', 'Spiele', 'Tore', 'Assists', 'Punkte', 'PlusMinus', 'Strafminuten'];
  const lines = rows
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .map((r) => [r.player.number ?? '', r.player.name, r.player.position, r.gp, r.goals, r.assists, r.points, r.plusMinus, r.pim]);
  const csv = [header, ...lines]
    .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `statistik-${season.replace('/', '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function StatsView() {
  const allMatches = store.list('matches');
  const seasons = [...new Set([seasonOf(today()), ...allMatches.map((m) => m.season)])].sort().reverse();
  const [season, setSeason] = useState(seasons[0]);

  const matches = allMatches.filter((m) => m.season === season);
  const matchIds = new Set(matches.map((m) => m.id));
  const events = store.list('events', (e) => matchIds.has(e.match_id));
  const eventsByMatch = new Map();
  for (const e of events) {
    if (!eventsByMatch.has(e.match_id)) eventsByMatch.set(e.match_id, []);
    eventsByMatch.get(e.match_id).push(e);
  }

  const rows = playerStats(store.list('players'), matches, events)
    .filter((r) => r.gp > 0 || r.points || r.pim);
  const team = teamSummary(matches, eventsByMatch);

  return html`
    <${PageHead} eyebrow=${`${TEAM_NAME} · Saisonbilanz`} title="Statistik" outline=${`Saison ${season}`}
      extra=${html`
        <div class="kpis">
          <div class="fx"><span class="meta-label">Spiele</span><strong class="d lit">${team.played}</strong></div>
          <div class="fx"><span class="meta-label">Siege · Unent. · Niederl.</span><strong class="d chrome">${team.w}-${team.d}-${team.l}</strong></div>
          <div class="fx wide"><span class="meta-label">Torverhältnis</span><strong class="d"><span class="lit">${team.gf}</span><span class="outline">:${team.ga}</span></strong></div>
        </div>`}>
      <select value=${season} aria-label="Saison wählen" onChange=${(e) => setSeason(e.target.value)}>
        ${seasons.map((s) => html`<option value=${s}>Saison ${s}</option>`)}
      </select>
    <//>

    <section class="wrap content">
      <${SecHead} eyebrow="Skorerliste" title="Spieler"
        aside=${rows.length > 0 && html`
          <button class="sec-link" onClick=${() => exportCsv(season, rows)}>Excel-Export (CSV) <span class="arr">→</span></button>`} />
      <${StatsTable} rows=${rows} />
      <p class="hint">Sp = Spiele, T = Tore, A = Assists, P = Punkte, SM = Strafminuten. Tippe auf eine Spalte zum Sortieren.</p>
    </section>`;
}
