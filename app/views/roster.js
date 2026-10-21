// Kader: alle sehen ihn, nur der Admin kann ihn ändern
import { html, useState } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { Sheet, byNumber } from '../ui.js';

const POSITIONS = [
  { code: 'S', label: 'Stürmer' },
  { code: 'V', label: 'Verteidiger' },
  { code: 'G', label: 'Goalie' },
];
const positionLabel = (c) => POSITIONS.find((p) => p.code === c)?.label ?? c;

function PlayerForm({ player, onClose }) {
  const [draft, setDraft] = useState(player || { name: '', number: '', position: 'S', active: true });

  function save(e) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const number = draft.number === '' || draft.number == null ? null : Number(draft.number);
    store.save('players', { ...draft, name: draft.name.trim(), number });
    onClose();
  }

  function remove() {
    if (confirm(`${player.name} löschen? Besser: auf "inaktiv" setzen, dann bleibt die Statistik erhalten.`)) {
      store.remove('players', player.id);
      onClose();
    }
  }

  return html`
    <${Sheet} title=${player ? 'Spieler bearbeiten' : 'Spieler hinzufügen'} onClose=${onClose}>
      <form class="form" onSubmit=${save}>
        <label>Name
          <input required autofocus value=${draft.name} onInput=${(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label>Rückennummer
          <input type="number" inputmode="numeric" min="0" max="99" value=${draft.number ?? ''}
            onInput=${(e) => setDraft({ ...draft, number: e.target.value })} />
        </label>
        <div class="seg full">
          ${POSITIONS.map((p) => html`
            <button type="button" class=${draft.position === p.code ? 'on' : ''}
              onClick=${() => setDraft({ ...draft, position: p.code })}>${p.label}</button>`)}
        </div>
        ${player && html`
          <label class="check">
            <input type="checkbox" checked=${draft.active} onChange=${(e) => setDraft({ ...draft, active: e.target.checked })} />
            Aktiv (erscheint im Aufgebot)
          </label>`}
        <div class="actions">
          ${player && html`<button type="button" class="btn danger" onClick=${remove}>Löschen</button>`}
          <button class="btn primary">Speichern</button>
        </div>
      </form>
    <//>`;
}

export function RosterView({ user }) {
  const [editing, setEditing] = useState(null); // null | 'new' | player
  const players = store.list('players').sort(byNumber);
  const active = players.filter((p) => p.active);
  const inactive = players.filter((p) => !p.active);

  const row = (p) => html`
    <li>
      <button class="player-row" disabled=${!user.isAdmin} onClick=${() => setEditing(p)}>
        <span class="num">${p.number ?? '–'}</span>
        <span class="name">${p.name}</span>
        <span class="muted">${positionLabel(p.position)}</span>
      </button>
    </li>`;

  return html`
    <section>
      <h1>Kader <small>${active.length} aktiv</small></h1>
      ${user.isAdmin
        ? html`<button class="btn primary full" onClick=${() => setEditing('new')}>+ Spieler hinzufügen</button>`
        : html`<p class="hint">Änderungen am Kader macht der Admin.</p>`}
      <ul class="list">${active.map(row)}</ul>
      ${inactive.length > 0 && html`<h2>Inaktiv</h2><ul class="list">${inactive.map(row)}</ul>`}
      ${editing && html`<${PlayerForm} player=${editing === 'new' ? null : editing} onClose=${() => setEditing(null)} />`}
    </section>`;
}
