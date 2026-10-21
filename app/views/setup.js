// Match anlegen/bearbeiten: Gegner, Datum, Aufgebot und Linien
import { html, useState } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { seasonOf } from '../stats.js';
import { byNumber, navigate, today } from '../ui.js';

const LINE_COUNT = 4;

function initialDraft(id) {
  const existing = id && store.get('matches', id);
  if (existing) return { ...existing };

  // Neues Match: Aufgebot und Linien vom letzten Match übernehmen
  const last = store.list('matches').sort((a, b) => b.date.localeCompare(a.date))[0];
  const active = store.list('players', (p) => p.active);
  const activeIds = new Set(active.map((p) => p.id));
  return {
    id: store.uuid(),
    date: today(),
    opponent: '',
    home: true,
    roster: last ? last.roster.filter((pid) => activeIds.has(pid)) : active.map((p) => p.id),
    lines: last ? last.lines.map((l) => l.filter((pid) => activeIds.has(pid))) : [],
  };
}

export function SetupView({ id }) {
  const [draft, setDraft] = useState(() => initialDraft(id));
  const isNew = !id;
  const roster = new Set(draft.roster);
  const players = store.list('players', (p) => p.active || roster.has(p.id)).sort(byNumber);

  const lineOf = (pid) => draft.lines.findIndex((l) => l.includes(pid));

  function toggleRoster(pid) {
    const inRoster = roster.has(pid);
    setDraft({
      ...draft,
      roster: inRoster ? draft.roster.filter((x) => x !== pid) : [...draft.roster, pid],
      lines: inRoster ? draft.lines.map((l) => l.filter((x) => x !== pid)) : draft.lines,
    });
  }

  function setLine(pid, idx) {
    const lines = Array.from({ length: LINE_COUNT }, (_, i) => (draft.lines[i] || []).filter((x) => x !== pid));
    if (idx >= 0) lines[idx].push(pid);
    while (lines.length && !lines[lines.length - 1].length) lines.pop();
    setDraft({
      ...draft,
      lines,
      roster: roster.has(pid) ? draft.roster : [...draft.roster, pid],
    });
  }

  function save(goLive) {
    if (!draft.opponent.trim()) return alert('Bitte Gegner eintragen.');
    const m = store.save('matches', { ...draft, opponent: draft.opponent.trim(), season: seasonOf(draft.date) });
    navigate(goLive ? `#/match/${m.id}/live` : `#/match/${m.id}`);
  }

  return html`
    <section>
      <h1>${isNew ? 'Neues Match' : 'Match bearbeiten'}</h1>
      <div class="card form">
        <label>Gegner
          <input value=${draft.opponent} placeholder="z.B. UHC Muster" onInput=${(e) => setDraft({ ...draft, opponent: e.target.value })} />
        </label>
        <div class="row">
          <label>Datum
            <input type="date" value=${draft.date} onInput=${(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <div class="seg">
            <button type="button" class=${draft.home ? 'on' : ''} onClick=${() => setDraft({ ...draft, home: true })}>Heim</button>
            <button type="button" class=${!draft.home ? 'on' : ''} onClick=${() => setDraft({ ...draft, home: false })}>Auswärts</button>
          </div>
        </div>
      </div>

      <h2>Aufgebot & Linien <small>${draft.roster.length} Spieler</small></h2>
      ${players.length === 0 && html`<p class="muted">Noch keine Spieler im Kader. <a href="#/kader">Kader erfassen</a></p>`}
      <ul class="list setup-list">
        ${players.map((p) => {
          const line = lineOf(p.id);
          return html`
            <li class=${roster.has(p.id) ? '' : 'out'}>
              <label class="check">
                <input type="checkbox" checked=${roster.has(p.id)} onChange=${() => toggleRoster(p.id)} />
                <span class="num">${p.number ?? '–'}</span> ${p.name} <small class="muted">${p.position}</small>
              </label>
              ${p.position !== 'G' && html`
                <div class="seg small">
                  <button type="button" class=${line === -1 ? 'on' : ''} onClick=${() => setLine(p.id, -1)}>–</button>
                  ${Array.from({ length: LINE_COUNT }, (_, i) => html`
                    <button type="button" class=${line === i ? 'on' : ''} onClick=${() => setLine(p.id, i)}>${i + 1}</button>`)}
                </div>`}
            </li>`;
        })}
      </ul>

      <div class="actions sticky">
        ${isNew
          ? html`<button class="btn primary big" onClick=${() => save(true)}>Speichern & Live erfassen</button>`
          : html`<button class="btn primary big" onClick=${() => save(false)}>Speichern</button>`}
      </div>
    </section>`;
}
