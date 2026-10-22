// Statistik-Berechnungen (reine Funktionen, ohne UI).

// Strafminuten je Strafart. Matchstrafe wird wie im Eishockey mit 20' gezählt –
// hier anpassen, falls ihr anders zählt.
export const PENALTIES = [
  { code: '2', label: "2'", minutes: 2 },
  { code: '2+2', label: "2+2'", minutes: 4 },
  { code: '5', label: "5'", minutes: 5 },
  { code: '10', label: "10'", minutes: 10 },
  { code: 'MS', label: 'Matchstrafe', minutes: 20 },
];
export const penaltyMinutes = (code) => PENALTIES.find((p) => p.code === code)?.minutes ?? 0;
export const penaltyLabel = (code) => PENALTIES.find((p) => p.code === code)?.label ?? code;

// Saison läuft von Juli bis Juni, z.B. 2026-10-21 → "2026/27"
export function seasonOf(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const start = d.getMonth() >= 6 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

export function score(events) {
  let us = 0, them = 0;
  for (const e of events) {
    if (e.type === 'goal_for') us++;
    else if (e.type === 'goal_against') them++;
  }
  return { us, them };
}

// Statistik pro Spieler über die gegebenen Matches/Events.
export function playerStats(players, matches, events) {
  const rows = new Map(players.map((p) => [p.id, {
    player: p, gp: 0, goals: 0, assists: 0, points: 0, plusMinus: 0, pim: 0,
  }]));
  const row = (id) => rows.get(id);

  for (const m of matches) for (const id of m.roster) if (row(id)) row(id).gp++;

  for (const e of events) {
    if (e.type === 'goal_for') {
      if (row(e.scorer_id)) row(e.scorer_id).goals++;
      if (row(e.assist_id)) row(e.assist_id).assists++;
      for (const id of e.on_ice) if (row(id)) row(id).plusMinus++;
    } else if (e.type === 'goal_against') {
      for (const id of e.on_ice) if (row(id)) row(id).plusMinus--;
    } else if (e.type === 'penalty') {
      if (row(e.player_id)) row(e.player_id).pim += penaltyMinutes(e.penalty);
    }
  }
  for (const r of rows.values()) r.points = r.goals + r.assists;
  return [...rows.values()];
}

export function teamSummary(matches, eventsByMatch) {
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const m of matches) {
    const s = score(eventsByMatch.get(m.id) || []);
    gf += s.us; ga += s.them;
    if (s.us > s.them) w++; else if (s.us < s.them) l++; else d++;
  }
  return { played: matches.length, w, d, l, gf, ga };
}

// Event-Reihenfolge: Hälfte, dann Spielzeit, dann Erfassungszeit
export function sortEvents(events) {
  const t = (e) => {
    const [mm, ss] = (e.game_time || '').split(':').map(Number);
    return Number.isFinite(mm) ? mm * 60 + (ss || 0) : Infinity;
  };
  return [...events].sort((a, b) =>
    (a.period ?? 9) - (b.period ?? 9) || t(a) - t(b) || a.created_at.localeCompare(b.created_at));
}
