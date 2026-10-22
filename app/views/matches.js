import { html, useState } from '../../vendor/preact-htm.module.js';
import * as api from '../api.js';
import * as store from '../store.js';
import { TEAM_NAME, SU_TEAM_ID } from '../config.js';
import { score, seasonOf } from '../stats.js';
import { PageHead, SecHead, formatDate, navigate, today } from '../ui.js';

// Spielplan der aktuellen Saison von swiss unihockey holen (nur Admin)
function ImportButton({ onResult }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    onResult(null);
    try {
      const r = await api.invoke('import-games', { team_id: SU_TEAM_ID });
      const parts = [`${r.created} neu`, `${r.updated} aktualisiert`];
      if (r.linked) parts.push(`${r.linked} mit bestehenden verknüpft`);
      onResult({ ok: true, text: `Spielplan ${r.season} importiert: ${parts.join(', ')}.` });
      await store.sync();
    } catch (e) {
      onResult({ ok: false, text: `Import fehlgeschlagen: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };
  return html`<button class="btn big" disabled=${busy} onClick=${run}>${busy ? 'Importiere…' : 'Spielplan importieren'}</button>`;
}

export function MatchesView({ user }) {
  const [importResult, setImportResult] = useState(null);
  const matches = store.list('matches').sort((a, b) => b.date.localeCompare(a.date));
  const currentSeason = seasonOf(today());

  const bySeason = new Map();
  for (const m of matches) {
    if (!bySeason.has(m.season)) bySeason.set(m.season, []);
    bySeason.get(m.season).push(m);
  }
  if (!bySeason.has(currentSeason)) bySeason.set(currentSeason, []);
  const seasons = [...bySeason.keys()].sort().reverse();

  return html`
    <${PageHead} eyebrow=${`UHCevi Gossau · ${TEAM_NAME}`} title="Matches" outline="& Resultate"
      digit=${TEAM_NAME.replace(/\D/g, '') || null}>
      <button class="btn primary big" onClick=${() => navigate('#/match/new')}>Neues Match <span class="arr">→</span></button>
      ${user?.isAdmin && !user.demo && SU_TEAM_ID && html`<${ImportButton} onResult=${setImportResult} />`}
    <//>
    <div class="wrap content">
      ${importResult && html`<p class=${importResult.ok ? 'muted' : 'error'} role="status">${importResult.text}</p>`}
      ${seasons.map((season) => {
        const list = bySeason.get(season);
        return html`
          <${SecHead} eyebrow="Spielplan" title=${`Saison ${season}`}
            aside=${html`<span class="count">${list.length} ${list.length === 1 ? 'Match' : 'Matches'}</span>`} />
          ${list.length === 0 && html`<p class="muted">Noch keine Matches.</p>`}
          <ul class="match-grid">
            ${list.map((m) => {
              const s = score(store.list('events', (e) => e.match_id === m.id));
              const result = s.us > s.them ? 'win' : s.us < s.them ? 'loss' : 'draw';
              return html`
                <li class="rv">
                  <a href=${`#/match/${m.id}`} class=${`card fx match-card ${m.home ? 'home' : ''}`}>
                    <span class="top">
                      <span class="d date">${formatDate(m.date)}</span>
                      <span class=${`badge ${m.home ? 'home' : ''}`}>${m.home ? 'Heimspiel' : 'Auswärts'}</span>
                    </span>
                    <span class="bottom">
                      <span class="opp">
                        <span class="meta-label">${m.home ? 'vs.' : 'bei'}</span>
                        <span class="c">${m.opponent}</span>
                      </span>
                      <span class=${`result ${result}`}>${s.us}:${s.them}</span>
                    </span>
                  </a>
                </li>`;
            })}
          </ul>`;
      })}
    </div>`;
}
