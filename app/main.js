import { html, render, useState, useEffect } from '../vendor/preact-htm.module.js';
import * as api from './api.js';
import * as store from './store.js';
import { TEAM_NAME } from './config.js';
import { SyncBadge } from './ui.js';
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
    const on = () => setHash(location.hash || '#/');
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

  return html`
    <header class="topbar">
      <a href="#/" class="brand">${TEAM_NAME} <span>Statistik</span></a>
      <${SyncBadge} />
    </header>
    <main class=${live ? 'live-main' : ''}>${route(hash, user)}</main>
    ${!live && html`
      <nav class="tabbar">
        <a href="#/" class=${tab === 'matches' ? 'active' : ''}>Matches</a>
        <a href="#/stats" class=${tab === 'stats' ? 'active' : ''}>Statistik</a>
        <a href="#/kader" class=${tab === 'kader' ? 'active' : ''}>Kader</a>
      </nav>
      <footer class="foot">
        ${user.demo
          ? html`<span>Demo-Modus – Daten nur in diesem Browser</span>`
          : html`<span>${user.isAdmin ? 'Admin' : 'Team'}-Login</span>
                 <button type="button" class="link" onClick=${() => { api.logout(); setUser(null); }}>Abmelden</button>`}
      </footer>`}`;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js');
}
