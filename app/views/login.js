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
    <main class="login">
      <h1>${TEAM_NAME} <span>Statistik</span></h1>
      <form onSubmit=${submit} class="card">
        ${admin && html`
          <label>E-Mail
            <input type="email" autocomplete="username" required value=${email} onInput=${(e) => setEmail(e.target.value)} />
          </label>`}
        <label>${admin ? 'Passwort' : 'Team-Passwort'}
          <input type="password" autocomplete="current-password" required value=${password}
            onInput=${(e) => setPassword(e.target.value)} />
        </label>
        ${error && html`<p class="error">${error}</p>`}
        <button class="btn primary big" disabled=${busy}>${busy ? 'Anmelden…' : 'Anmelden'}</button>
        ${TEAM_EMAIL && html`
          <button type="button" class="link" onClick=${() => setAdmin(!admin)}>
            ${admin ? 'Mit Team-Passwort anmelden' : 'Als Admin anmelden'}
          </button>`}
      </form>
    </main>`;
}
