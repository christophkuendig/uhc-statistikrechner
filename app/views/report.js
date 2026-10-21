// Matchbericht: Resultat, Verlauf und Spielerstatistik eines Matches
import { html } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { TEAM_NAME } from '../config.js';
import { playerStats, score, sortEvents } from '../stats.js';
import { formatDate, navigate, playerById } from '../ui.js';
import { EventText } from './live.js';
import { StatsTable } from './stats.js';

export function ReportView({ id, user }) {
  const match = store.get('matches', id);
  if (!match) return html`<p>Match nicht gefunden. <a href="#/">Zurück</a></p>`;

  const events = sortEvents(store.list('events', (e) => e.match_id === id));
  const s = score(events);
  const players = match.roster.map(playerById).filter(Boolean);
  const rows = playerStats(players, [match], events);

  function deleteMatch() {
    if (confirm(`Match gegen ${match.opponent} mit allen Einträgen löschen?`)) {
      events.forEach((e) => store.remove('events', e.id));
      store.remove('matches', id);
      navigate('#/');
    }
  }

  return html`
    <section>
      <p class="muted">${formatDate(match.date)} · ${match.home ? 'Heimspiel' : 'Auswärtsspiel'} · Saison ${match.season}</p>
      <div class="scoreboard static">
        <div class="score">
          <span class="team">${TEAM_NAME}</span>
          <strong>${s.us} : ${s.them}</strong>
          <span class="team">${match.opponent}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" onClick=${() => navigate(`#/match/${id}/live`)}>Erfassen / korrigieren</button>
        <button class="btn" onClick=${() => navigate(`#/match/${id}/setup`)}>Aufgebot & Linien</button>
      </div>

      <h2>Spieler</h2>
      <${StatsTable} rows=${rows} showGp=${false} />

      <h2>Verlauf</h2>
      ${events.length === 0 && html`<p class="muted">Keine Einträge.</p>`}
      <ul class="list events">
        ${events.map((e) => html`<li><div class="event-row"><${EventText} event=${e} /></div></li>`)}
      </ul>

      ${user.isAdmin && html`<button class="btn danger full" onClick=${deleteMatch}>Match löschen</button>`}
    </section>`;
}
