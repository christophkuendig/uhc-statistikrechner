import { html, useState } from '../../vendor/preact-htm.module.js';
import * as api from '../api.js';
import { TEAM_EMAIL, TEAM_NAME } from '../config.js';

export function LoginView({ onLogin }) {
  const [admin, setAdmin] = useState(!TEAM_EMAIL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(admin ? email.trim() : TEAM_EMAIL, password));
    } catch (err) {
      setError(navigator.onLine ? 'Falsches Passwort oder E-Mail.' : 'Keine Verbindung. Für die erste Anmeldung braucht es Internet.');
    } finally {
      setBusy(false);
    }
  }

  return html`
    <main class="stage login">
      <span class="ghost-digit" aria-hidden="true">${TEAM_NAME.replace(/\D/g, '') || 'U'}</span>
      <div class="wrap">
        <div class="intro">
          <p class="eyebrow">UHCevi Gossau</p>
          <h1 class="d"><span class="chrome">${TEAM_NAME}</span><span class="outline">Statistik</span></h1>
          <p class="lead muted">Tore, Assists, Plus/Minus und Strafen – live von der Bank erfasst.</p>
        </div>
        <form onSubmit=${submit} class="glass stagebox">
          ${admin && html`
            <label>E-Mail
              <input type="email" autocomplete="username" required value=${email} onInput=${(e) => setEmail(e.target.value)} />
            </label>`}
          <label>${admin ? 'Passwort' : 'Team-Passwort'}
            <input type="password" autocomplete="current-password" required value=${password}
              onInput=${(e) => setPassword(e.target.value)} />
          </label>
          ${error && html`<p class="error" role="alert">${error}</p>`}
          <button class="btn primary big" disabled=${busy}>${busy ? 'Anmelden…' : html`Anmelden <span class="arr">→</span>`}</button>
          ${TEAM_EMAIL && html`
            <button type="button" class="link" onClick=${() => setAdmin(!admin)}>
              ${admin ? 'Mit Team-Passwort anmelden' : 'Als Admin anmelden'}
            </button>`}
        </form>
      </div>
    </main>`;
}
