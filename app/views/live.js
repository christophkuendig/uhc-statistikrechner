// Live-Erfassung während dem Match – für jemanden auf der Bank ohne Einarbeitung
import { html, useState } from '../../vendor/preact-htm.module.js';
import * as store from '../store.js';
import { TEAM_NAME } from '../config.js';
import { PENALTIES, penaltyLabel, score, sortEvents } from '../stats.js';
import { Icon, PlayerGrid, SecHead, Sheet, byNumber, navigate, playerById, playerLabel } from '../ui.js';

const PERIODS = [
  { value: 1, label: '1.' },
  { value: 2, label: '2.' },
];
// Anzeigetafel als Flutlicht-Bühne – geteilt von Live-Erfassung und Matchbericht
export function MatchStage({ match, score: s, meta, digit, compact, children }) {
  return html`
    <section class=${`stage matchstage ${compact ? 'compact' : ''}`}>
      <span class="ghost-digit" aria-hidden="true">${digit ?? s.us}</span>
      <div class="wrap">
        <div class="meta-line">${meta}</div>
        <div class="scoreline">
          <div class="side">
            <span class="meta-label">${match.home ? 'Heim' : 'Gast'}</span>
            <span class="team-tag">${TEAM_NAME}</span>
          </div>
          <div class="d score lit" aria-label=${`${s.us} zu ${s.them}`}>
            <span>${s.us}</span><span class="sep">:</span><span class="outline">${s.them}</span>
          </div>
          <div class="side them">
            <span class="meta-label">${match.home ? 'Gast' : 'Heim'}</span>
            <span class="c">${match.opponent}</span>
          </div>
        </div>
        ${children}
      </div>
    </section>`;
}

const periodLabel = (v) => (v ? `${v}. Hälfte` : '');

// Aktuelle Linie / Hälfte überleben ein Neuladen der Seite
function useLiveState(matchId) {
  const key = `uhc.live.${matchId}`;
  const [state, setState] = useState(() => {
    try { return { line: 0, prevLine: null, period: 1, ...JSON.parse(localStorage.getItem(key)) }; }
    catch { return { line: 0, prevLine: null, period: 1 }; }
  });
  const update = (patch) => {
    const next = { ...state, ...patch };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    setState(next);
  };
  return [state, update];
}

const STEPS = {
  goal_for: ['scorer', 'assist', 'onice'],
  goal_against: ['onice'],
  penalty: ['player', 'penalty'],
};

export function LiveView({ id }) {
  const match = store.get('matches', id);
  const [live, setLive] = useLiveState(id);
  const [flow, setFlow] = useState(null); // { draft, step }

  if (!match) return html`<div class="wrap content"><p>Match nicht gefunden. <a href="#/">Zurück</a></p></div>`;

  const roster = match.roster.map(playerById).filter(Boolean).sort(byNumber);
  const fieldPlayers = roster.filter((p) => p.position !== 'G');
  const events = sortEvents(store.list('events', (e) => e.match_id === id));
  const s = score(events);
  const lines = match.lines.filter((l) => l.length);

  // Block eines Spielers: die aktive Linie, falls er dort steht, sonst seine erste Linie
  function blockOf(pid) {
    if (!pid) return null;
    if ((lines[live.line] || []).includes(pid)) return live.line;
    const idx = lines.findIndex((l) => l.includes(pid));
    return idx >= 0 ? idx : null;
  }

  function selectLine(idx) {
    if (idx !== live.line) setLive({ line: idx, prevLine: live.line });
  }

  function start(type) {
    const draft = { id: store.uuid(), match_id: id, type, period: live.period, game_time: '', on_ice: [] };
    if (type === 'goal_against') draft.on_ice = [...(lines[live.line] || [])];
    setFlow({ draft, step: 0, isNew: true });
  }

  function edit(ev) {
    setFlow({ draft: { ...ev, on_ice: [...ev.on_ice] }, step: 0, isNew: false });
  }

  const steps = flow ? STEPS[flow.draft.type] : [];
  const stepName = steps[flow?.step];
  const setDraft = (patch) => setFlow({ ...flow, draft: { ...flow.draft, ...patch } });

  function next(patch = {}) {
    let draft = { ...flow.draft, ...patch };
    const nextStep = flow.step + 1;
    // Beim Wechsel zur Feldspieler-Auswahl: Block des Torschützen (sonst aktuelle Linie) + Torschütze/Assist vorauswählen
    if (steps[nextStep] === 'onice' && flow.isNew && !flow.onIceSeeded) {
      const pre = new Set(lines[blockOf(draft.scorer_id) ?? live.line] || []);
      if (draft.scorer_id) pre.add(draft.scorer_id);
      if (draft.assist_id) pre.add(draft.assist_id);
      draft.on_ice = [...pre];
      return setFlow({ ...flow, draft, step: nextStep, onIceSeeded: true });
    }
    if (nextStep >= steps.length) return finish(draft);
    setFlow({ ...flow, draft, step: nextStep });
  }

  function finish(draft) {
    store.save('events', draft);
    setFlow(null);
  }

  function removeEvent() {
    if (confirm('Diesen Eintrag löschen?')) {
      store.remove('events', flow.draft.id);
      setFlow(null);
    }
  }

  function toggleOnIce(pid) {
    const set = new Set(flow.draft.on_ice);
    set.has(pid) ? set.delete(pid) : set.add(pid);
    setDraft({ on_ice: [...set] });
  }

  function renderStep() {
    const d = flow.draft;
    if (stepName === 'scorer') {
      return html`
        <p class="d step-q">Wer hat das Tor geschossen?</p>
        <${PlayerGrid} players=${fieldPlayers.concat(roster.filter((p) => p.position === 'G'))}
          selected=${d.scorer_id} onPick=${(pid) => next({ scorer_id: pid })} />
        <button class="btn dashed full" onClick=${() => next({ scorer_id: null })}>Unbekannt / Eigentor Gegner</button>`;
    }
    if (stepName === 'assist') {
      const others = roster.filter((p) => p.id !== d.scorer_id);
      const block = new Set(lines[blockOf(d.scorer_id)] || []);
      const groups = block.size ? [
        { title: `Block des Torschützen (L${blockOf(d.scorer_id) + 1})`, players: others.filter((p) => block.has(p.id)) },
        { title: 'Weitere Spieler', players: others.filter((p) => !block.has(p.id)) },
      ].filter((g) => g.players.length) : [{ players: others }];
      return html`
        <p class="d step-q">Assist?</p>
        <button class="btn full" onClick=${() => next({ assist_id: null })}>Kein Assist</button>
        ${groups.map((g) => html`
          ${g.title && html`<h3 class="meta-label group-label">${g.title}</h3>`}
          <${PlayerGrid} players=${g.players} selected=${d.assist_id} onPick=${(pid) => next({ assist_id: pid })} />`)}`;
    }
    if (stepName === 'onice') {
      const selected = new Set(d.on_ice);
      const scorerBlock = blockOf(d.scorer_id);
      const blk = new Set(scorerBlock != null && scorerBlock !== live.line ? lines[scorerBlock] : []);
      const cur = new Set(lines[live.line] || []);
      const prev = new Set(live.prevLine != null ? lines[live.prevLine] || [] : []);
      const groups = [
        { title: `Block des Torschützen (L${scorerBlock + 1})`, players: fieldPlayers.filter((p) => blk.has(p.id)) },
        { title: `Aktuelle Linie ${lines.length ? live.line + 1 : ''}`, players: fieldPlayers.filter((p) => cur.has(p.id) && !blk.has(p.id)) },
        { title: `Vorherige Linie ${live.prevLine != null ? live.prevLine + 1 : ''}`, players: fieldPlayers.filter((p) => prev.has(p.id) && !cur.has(p.id) && !blk.has(p.id)) },
        { title: 'Weitere Spieler', players: fieldPlayers.filter((p) => !cur.has(p.id) && !prev.has(p.id) && !blk.has(p.id)) },
      ].filter((g) => g.players.length);
      const n = selected.size;
      return html`
        <p class="d step-q">Wer war auf dem Feld? <small>Für +/−, ohne Goalie</small></p>
        ${groups.map((g) => html`
          <h3 class="meta-label group-label">${g.title}</h3>
          <${PlayerGrid} players=${g.players} selected=${selected} onPick=${toggleOnIce} />`)}
        <p class=${n > 6 || n === 0 ? 'warn' : 'muted'}>
          ${n} Feldspieler ausgewählt${n > 6 ? ' – mehr als 6, stimmt das?' : ''}
        </p>`;
    }
    if (stepName === 'player') {
      return html`
        <p class="d step-q">Wer hat die Strafe erhalten?</p>
        <${PlayerGrid} players=${roster} selected=${d.player_id} onPick=${(pid) => next({ player_id: pid })} />
        <button class="btn dashed full" onClick=${() => next({ player_id: null })}>Teamstrafe / Bank</button>`;
    }
    if (stepName === 'penalty') {
      return html`
        <p class="d step-q">Welche Strafe?</p>
        <div class="choice-grid">
          ${PENALTIES.map((p) => html`
            <button class=${`btn big ${d.penalty === p.code ? 'primary' : ''}`} onClick=${() => next({ penalty: p.code })}>${p.label}</button>`)}
        </div>`;
    }
  }

  const titles = { goal_for: 'Tor für uns', goal_against: 'Gegentor', penalty: 'Strafe' };
  const lastStep = flow && flow.step === steps.length - 1;
  // Bei Auswahl-Schritten reicht ein Tipp auf einen Spieler; nur die Feldspieler-Auswahl braucht "Speichern"
  const needsConfirm = stepName === 'onice';

  return html`
    <${MatchStage} match=${match} score=${s} digit=${live.period} compact
      meta=${html`
        <button class="icon-btn" aria-label="Zum Matchbericht" onClick=${() => navigate(`#/match/${id}`)}><${Icon} name="back" /></button>
        <span class="live-badge">LIVE</span>
        <span class="eyebrow">${periodLabel(live.period)}</span>`}>
      <div class="live-controls">
        <div class="seg full" role="group" aria-label="Hälfte">
          ${PERIODS.map((p) => html`
            <button class=${live.period === p.value ? 'on' : ''} onClick=${() => setLive({ period: p.value })}>${p.label}</button>`)}
        </div>
        ${lines.length > 0 && html`
          <div class="ctl">
            <span class="meta-label">Linie auf dem Feld</span>
            <div class="chips" role="group" aria-label="Linie auf dem Feld">
              ${lines.map((l, i) => html`
                <button class=${`chip ${live.line === i ? 'on' : ''}`} onClick=${() => selectLine(i)}>L${i + 1}</button>`)}
            </div>
          </div>`}
      </div>
    <//>

    <section class="wrap content live">
      <div class="event-buttons">
        <button class="btn primary big goal" onClick=${() => start('goal_for')}>Tor ${TEAM_NAME}</button>
        <button class="btn ink big" onClick=${() => start('goal_against')}>Gegentor</button>
        <button class="btn big" onClick=${() => start('penalty')}>Strafe</button>
      </div>

      <${SecHead} eyebrow="Tippen zum Korrigieren" title="Verlauf" />
      ${events.length === 0 && html`<p class="muted">Noch keine Einträge. Tippe auf einen Eintrag, um ihn zu korrigieren.</p>`}
      <ul class="list card events">
        ${[...events].reverse().map((e) => html`
          <li><button class="event-row" onClick=${() => edit(e)}><${EventText} event=${e} /></button></li>`)}
      </ul>

      <button class="btn full" onClick=${() => navigate(`#/match/${id}`)}>Fertig – zum Matchbericht <span class="arr">→</span></button>
      ${flow && html`
        <${Sheet} title=${`${titles[flow.draft.type]}${flow.isNew ? '' : ' bearbeiten'}`} onClose=${() => setFlow(null)}
          footer=${html`
            ${flow.step > 0 && html`<button class="btn" onClick=${() => setFlow({ ...flow, step: flow.step - 1 })}>Zurück</button>`}
            ${!flow.isNew && html`<button class="btn danger" onClick=${removeEvent}>Löschen</button>`}
            ${(needsConfirm || !flow.isNew) && html`
              <button class="btn primary" onClick=${() => (lastStep ? finish(flow.draft) : next())}>
                ${lastStep ? 'Speichern' : 'Weiter'}
              </button>`}`}>
          ${renderStep()}
          ${(lastStep || stepName === 'onice') && html`
            <div class="row meta">
              <label>Hälfte
                <select value=${flow.draft.period ?? ''} onChange=${(e) => setDraft({ period: Number(e.target.value) || null })}>
                  ${PERIODS.map((p) => html`<option value=${p.value}>${periodLabel(p.value)}</option>`)}
                </select>
              </label>
              <label>Spielzeit (optional)
                <input inputmode="numeric" placeholder="mm:ss" value=${flow.draft.game_time || ''}
                  onInput=${(e) => setDraft({ game_time: e.target.value })} />
              </label>
            </div>`}
        <//>`}
    </section>`;
}

export function EventText({ event: e }) {
  const when = [periodLabel(e.period), e.game_time].filter(Boolean).join(' · ');
  const onIce = e.on_ice.map(playerById).filter(Boolean).sort(byNumber).map((p) => p.number ?? p.name).join(', ');
  if (e.type === 'goal_for') {
    return html`
      <span class="ev-icon goal">T</span>
      <span class="ev-main">
        <strong>${playerLabel(playerById(e.scorer_id))}</strong>
        ${e.assist_id && html` <span class="muted">(A: ${playerLabel(playerById(e.assist_id))})</span>`}
        <small>${when}${onIce && ` · +1: ${onIce}`}</small>
      </span>`;
  }
  if (e.type === 'goal_against') {
    return html`
      <span class="ev-icon against">G</span>
      <span class="ev-main"><strong>Gegentor</strong><small>${when}${onIce && ` · −1: ${onIce}`}</small></span>`;
  }
  return html`
    <span class="ev-icon penalty">S</span>
    <span class="ev-main">
      <strong>${penaltyLabel(e.penalty)} ${e.player_id ? playerLabel(playerById(e.player_id)) : 'Teamstrafe'}</strong>
      <small>${when}</small>
    </span>`;
}
