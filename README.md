# UHC Statistikrechner

Web-App, um am Match Tore, Assists, Plus/Minus und Strafen zu erfassen. Die Saisonstatistik entsteht automatisch.

- Läuft im Browser und lässt sich auf den Homescreen legen. Funktioniert auch ohne Netz und synchronisiert später.
- Daten liegen in Supabase und sind nur mit Team-Login sichtbar. Den Kader kann nur der Admin ändern.
- Keine Build-Tools, keine npm-Abhängigkeiten. Statische Dateien genügen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `styles.css` | Einstieg und Layout |
| `app/config.js` | Supabase-URL, Key, Team-E-Mail (**hier eintragen**) |
| `app/store.js` | Lokaler Speicher und Sync mit Supabase |
| `app/stats.js` | Statistik-Berechnung, Strafminuten je Strafart |
| `app/views/` | Bildschirme (Matches, Aufgebot, Live, Bericht, Statistik, Kader) |
| `supabase/schema.sql` | Datenbank-Tabellen und Zugriffsrechte |
| `supabase/functions/import-games/` | Edge Function: Spielplan von swiss unihockey importieren |
| `vendor/` | Preact + htm (UI-Bibliothek, 13 KB) |

## Lokal starten

```bash
python3 -m http.server 8321
```

Danach http://localhost:8321 öffnen. Ohne Eintrag in `app/config.js` läuft die App im Demo-Modus und speichert nur im Browser.

## Spielplan-Import (swiss unihockey)

Der Admin sieht in der Match-Liste den Knopf «Spielplan importieren». Er legt alle Spiele der aktuellen Saison an, die noch fehlen. Verschobene Spiele werden nachgeführt. Schon von Hand erfasste Matches werden verknüpft statt doppelt angelegt. Die Daten kommen aus der öffentlichen API v2, dafür braucht es keinen API-Key.

Einmalig einrichten:

1. `supabase/schema.sql` erneut im SQL Editor ausführen. Das ergänzt die Spalte `matches.external_id`.
2. Die Edge Function deployen, entweder im Supabase Dashboard unter *Edge Functions → Deploy a new function → Via Editor* mit dem Namen `import-games` und dem Inhalt von `index.ts`, oder mit der CLI:
   ```bash
   supabase functions deploy import-games --project-ref wqwprkiqyaumhczxbjnh
   ```
3. Die Team-ID steht in `app/config.js` (`SU_TEAM_ID`).
