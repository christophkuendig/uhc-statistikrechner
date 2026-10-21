import { html } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { score, seasonOf } from '../stats.js';
import { formatDate, navigate, today } from '../ui.js';

export function MatchesView() {
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
    <section>
      <button class="btn primary big full" onClick=${() => navigate('#/match/new')}>+ Neues Match</button>
      <p class="hint">Auch für Matches, die bisher nur auf Papier erfasst sind: einfach das Datum anpassen.</p>
      ${seasons.map((season) => html`
        <h2>Saison ${season}</h2>
        ${bySeason.get(season).length === 0 && html`<p class="muted">Noch keine Matches.</p>`}
        <ul class="list">
          ${bySeason.get(season).map((m) => {
            const s = score(store.list('events', (e) => e.match_id === m.id));
            const result = s.us > s.them ? 'win' : s.us < s.them ? 'loss' : 'draw';
            return html`
              <li>
                <a href=${`#/match/${m.id}`} class="match-row">
                  <span class="date">${formatDate(m.date)}</span>
                  <span class="opp">${m.home ? 'vs.' : '@'} ${m.opponent}</span>
                  <span class=${`result ${result}`}>${s.us}:${s.them}</span>
                </a>
              </li>`;
          })}
        </ul>`)}
    </section>`;
}
