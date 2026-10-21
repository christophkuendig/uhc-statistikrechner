import { html, render, useState, useEffect } from '../vendor/preact-htm.module.js';
import * as api from './api.js';
import * as store from './store.js';
import { TEAM_NAME } from './config.js';
import { Icon, SyncBadge } from './ui.js';
import { initEffects } from './effects.js';
import { LoginView } from './views/login.js';
import { MatchesView } from './views/matches.js';
import { SetupView } from './views/setup.js';
import { LiveView } from './views/live.js';
import { ReportView } from './views/report.js';
import { StatsView } from './views/stats.js';
import { RosterView } from './views/roster.js';

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => { setHash(location.hash || '#/'); scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function route(hash, user) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (a === 'match' && b === 'new') return html`<${SetupView} />`;
  if (a === 'match' && c === 'setup') return html`<${SetupView} id=${b} />`;
  if (a === 'match' && c === 'live') return html`<${LiveView} id=${b} />`;
  if (a === 'match' && b) return html`<${ReportView} id=${b} user=${user} />`;
  if (a === 'stats') return html`<${StatsView} />`;
  if (a === 'kader') return html`<${RosterView} user=${user} />`;
  return html`<${MatchesView} />`;
}

function App() {
  const [, rerender] = useState(0);
  const [user, setUser] = useState(api.getUser());
  const hash = useHash();

  useEffect(() => store.subscribe(() => rerender((n) => n + 1)), []);
  useEffect(() => { if (user) store.sync(); }, [user]);

  // Abgelaufene Sitzung → zurück zum Login (lokale Daten bleiben erhalten)
  if (store.getStatus().state === 'auth' && user && !api.getUser()) setUser(null);

  if (!user) return html`<${LoginView} onLogin=${setUser} />`;

  const live = /\/live$/.test(hash);
  const tab = hash.startsWith('#/stats') ? 'stats' : hash.startsWith('#/kader') ? 'kader' : 'matches';

  const nav = (cls) => html`
    <nav class=${`nav ${cls}`} aria-label="Hauptnavigation">
      <a href="#/" class=${tab === 'matches' ? 'active' : ''}><${Icon} name="matches" />Matches</a>
      <a href="#/stats" class=${tab === 'stats' ? 'active' : ''}><${Icon} name="stats" />Statistik</a>
      <a href="#/kader" class=${tab === 'kader' ? 'active' : ''}><${Icon} name="roster" />Kader</a>
    </nav>`;

  return html`
    <header class="topbar on-dark">
      <a href="#/" class="brand"><span class="d">${TEAM_NAME}</span><span class="c">Statistik</span></a>
      <div class="topbar-right">
        ${!live && nav('')}
        <${SyncBadge} />
      </div>
    </header>
    <main>${route(hash, user)}</main>
    ${!live && html`
      ${nav('tabbar')}
      <footer class="stage foot">
        <div class="wrap">
          <span class="c club">UHCevi Gossau · ${TEAM_NAME}</span>
          <span class="who">
            ${user.demo
              ? html`<span>Demo-Modus – Daten nur in diesem Browser</span>`
              : html`<span>${user.isAdmin ? 'Admin' : 'Team'}-Login</span>
                     <button type="button" class="link" onClick=${() => { api.logout(); setUser(null); }}>Abmelden</button>`}
          </span>
        </div>
      </footer>`}`;
}

render(html`<${App} />`, document.getElementById('app'));
initEffects();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js');
}
