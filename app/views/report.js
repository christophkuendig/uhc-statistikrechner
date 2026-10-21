// Matchbericht: Resultat, Verlauf und Spielerstatistik eines Matches
import { html } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { playerStats, score, sortEvents } from '../stats.js';
import { SecHead, formatDate, navigate, playerById } from '../ui.js';
import { EventText, MatchStage } from './live.js';
import { StatsTable } from './stats.js';

export function ReportView({ id, user }) {
  const match = store.get('matches', id);
  if (!match) return html`<div class="wrap content"><p>Match nicht gefunden. <a href="#/">Zurück</a></p></div>`;

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
    <${MatchStage} match=${match} score=${s}
      meta=${html`<span class="eyebrow">${formatDate(match.date, true)} · Saison ${match.season}</span>
        ${match.home && html`<span class="badge home">Heimspiel</span>`}`}>
      <div class="actions">
        <button class="btn primary" onClick=${() => navigate(`#/match/${id}/live`)}>Erfassen / korrigieren <span class="arr">→</span></button>
        <button class="btn" onClick=${() => navigate(`#/match/${id}/setup`)}>Aufgebot & Linien</button>
      </div>
    <//>

    <div class="wrap content">
      <${SecHead} eyebrow="Matchbericht" title="Spieler" />
      <${StatsTable} rows=${rows} showGp=${false} />

      <${SecHead} eyebrow="Chronologie" title="Verlauf" />
      ${events.length === 0 && html`<p class="muted">Keine Einträge.</p>`}
      <ul class="list card events">
        ${events.map((e) => html`<li><div class="event-row"><${EventText} event=${e} /></div></li>`)}
      </ul>

      ${user.isAdmin && html`<button class="btn danger full" onClick=${deleteMatch}>Match löschen</button>`}
    </div>`;
}
