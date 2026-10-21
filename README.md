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
| `vendor/` | Preact + htm (UI-Bibliothek, 13 KB) |

## Lokal starten

```bash
python3 -m http.server 8321
```

Danach http://localhost:8321 öffnen. Ohne Eintrag in `app/config.js` läuft die App im Demo-Modus und speichert nur im Browser.
