// Edge Function: Spielplan der aktuellen Saison von swiss unihockey importieren.
// Nur für Admins. Nutzt die öffentliche API v2 (kein Key nötig) und schreibt
// mit dem JWT des Aufrufers in die Tabelle matches – es braucht keine Secrets.
//
// Aufruf: POST /functions/v1/import-games  { "team_id": 428001 }

const SU_API = 'https://api-v2.swissunihockey.ch/api';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Game = { external_id: string; date: string; opponent: string; home: boolean };

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url.split('?')[0]}: HTTP ${res.status}`);
  return res.json();
}

// Aktuelle Saison laut swiss unihockey, z.B. { year: 2026, text: "2026/27" }
async function currentSeason() {
  const data = await getJson(`${SU_API}/seasons`);
  const entry = data.entries.find((e: any) => e.highlight) ?? data.entries[0];
  return { year: entry.set_in_context.season as number, text: entry.text as string };
}

// Alle Spiele des Teams einer Saison, Seite für Seite
async function fetchGames(teamId: number, season: number): Promise<Game[]> {
  const games: Game[] = [];
  let page: number | undefined = 1;
  while (page) {
    const data = await getJson(
      `${SU_API}/games?mode=team&team_id=${teamId}&season=${season}&games_per_page=100&page=${page}`,
    );
    for (const region of data.data.regions ?? []) {
      for (const row of region.rows ?? []) {
        const id = row.link?.ids?.[0];
        const [dateCell, , homeCell, awayCell] = row.cells;
        const [d, m, y] = String(dateCell.text[0]).split('.');
        if (!id || !y) continue; // z.B. Spiel ohne festes Datum
        const home = Boolean(homeCell.highlight);
        games.push({
          external_id: `su:${id}`,
          date: `${y}-${m}-${d}`,
          opponent: (home ? awayCell : homeCell).text[0],
          home,
        });
      }
    }
    const next = data.data.slider?.next?.set_in_context?.page;
    page = next && next > page ? next : undefined;
  }
  return games;
}

// Index des von Hand erfassten Matches, das zum Spiel passt (oder -1).
// Treffer = gleiches Datum + Heim/Auswärts; bevorzugt mit Wörtern aus dem Gegnernamen.
function bestManualMatch(manual: any[], g: Game) {
  const official = g.opponent.toLowerCase();
  let best = -1, bestScore = -1;
  manual.forEach((m, i) => {
    if (m.date !== g.date || m.home !== g.home) return;
    const score = String(m.opponent).toLowerCase().split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && official.includes(w)).length;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: authorization, 'Content-Type': 'application/json' };

    // Nur Admins dürfen importieren
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
    if (!user.ok) return json({ error: 'Nicht angemeldet' }, 401);
    if ((await user.json()).app_metadata?.role !== 'admin') return json({ error: 'Nur für Admins' }, 403);

    const { team_id } = await req.json().catch(() => ({}));
    const teamId = Number(team_id);
    if (!Number.isInteger(teamId) || teamId <= 0) return json({ error: 'team_id fehlt' }, 400);

    const season = await currentSeason();
    const games = await fetchGames(teamId, season.year);

    // Bestehende Matches der Saison (inkl. gelöschte – die sollen gelöscht bleiben)
    const existing: any[] = await getJson(
      `${SUPABASE_URL}/rest/v1/matches?select=id,date,opponent,home,external_id,deleted&season=eq.${encodeURIComponent(season.text)}`,
      { headers },
    );
    const byExternal = new Map(existing.filter((m) => m.external_id).map((m) => [m.external_id, m]));
    const manual = existing.filter((m) => !m.external_id && !m.deleted);

    const now = new Date().toISOString();
    const rows: any[] = [];
    let created = 0, updated = 0, linked = 0;

    for (const g of games) {
      const known = byExternal.get(g.external_id);
      if (known) {
        // Verschoben oder Gegner korrigiert → nachführen
        if (known.date !== g.date || known.opponent !== g.opponent || known.home !== g.home) {
          rows.push({ id: known.id, date: g.date, opponent: g.opponent, home: g.home, season: season.text, external_id: g.external_id, updated_at: now });
          updated++;
        }
        continue;
      }
      // Schon von Hand erfasst (gleiches Datum, Heim/Auswärts)? → verknüpfen statt
      // doppelt anlegen. Bei zwei Spielen am selben Tag entscheidet der Gegnername.
      const i = bestManualMatch(manual, g);
      if (i >= 0) {
        const [m] = manual.splice(i, 1);
        rows.push({ id: m.id, ...g, season: season.text, updated_at: now });
        linked++;
        continue;
      }
      rows.push({ id: crypto.randomUUID(), ...g, season: season.text, updated_at: now });
      created++;
    }

    if (rows.length) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?on_conflict=id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`Speichern fehlgeschlagen: ${(await res.json().catch(() => ({}))).message ?? res.status}`);
    }

    return json({ season: season.text, total: games.length, created, updated, linked });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
