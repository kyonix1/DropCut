# DROPCUT — Fortnite Drop Calculator

Optimierter Drop-Planner für die **Glider-Cut-Mechanik** (Redeploy + jederzeit cuttbar):
**Spot markieren → Bus-Route markieren → Route wird automatisch generiert** — vom
Absprungspunkt, über das sofortige Öffnen des Gleiters, die Gleitbahn bis zum **Cut**
und dem finalen Sinkflug auf den Spot.

Die Karte kommt **live** von [fortnite-api.com](https://fortnite-api.com) (`/v1/map`
inkl. POIs mit echten Höhenkoordinaten). Das Höhenmodell kombiniert diese Season-aktuellen
POI-Höhen (IDW-Interpolation + Fein-Relief) mit einer optionalen, automatisch kalibrierten
Heightmap aus dem [Violevo/FortniteHeightmapGenerator](https://github.com/Violevo/FortniteHeightmapGenerator)-Repo
(Least-Squares-Fit auf die POI-Höhen) — denn Gleiten ist je nach Terrain unterschiedlich weit.

## Features

- Live-Karte der aktuellen Season (Blank-Textur, komplett ohne Namen)
- Interaktive Map: Pan/Zoom, Drag-Marker, Fadenkreuz
- Bus-Route im **Ingame-Stil** (blau gestrichelt, geflogener Abschnitt durchgehend)
- Numerische Optimierung des **Absprungspunkts** entlang der Bus-Route
  (Buszeit + Gleitzeit + Cut-Zeit, Terrain-Clearance als Constraint)
- Phasen-Visualisierung: Bus → Absprung (Redeploy) → Gleitbahn → **Cut** → Sinkflug
- **Höhenprofil-Chart** der kompletten Flugbahn (Terrain + Trajektorie)
- Warnungen bei Terrain-Blockaden / zu weiten Drops
- Spot bleibt nach der Kalkulation fixiert — weitere Klicks ändern nur die Route
- Ergebnis als Text kopierbar (für Team-Calls)

## Drop-Mechanik & Physik

Abfolge, die der Rechner abbildet — exakt die Ingame-Reihenfolge:

**BUS → JUMP → Freefall → DEPLOY → CUT → Freefall → Landung**

1. **Bus** — 73.3 m/s entlang der Route bis zum optimalen **Jump**-Punkt
2. **Freefall** — Skydive nach dem Absprung (14.5 m/s horizontal, 32 m/s Sinken)
3. **Deploy** — Gleiter auf (17 m/s horizontal, 7 m/s Sinken); nur nötig, wenn die
   Distanz im reinen Sturzflug nicht erreichbar ist
4. **Cut** — bei ~100 m über Terrain bliebe der Gleiter zwangsweise offen; der Cut
   schneidet ihn weg → wieder Freefall mit 32 m/s
5. **Landung** — kurz über Boden Gleiter erneut auf (nicht extra ausgewiesen)

| Parameter | Wert |
| --- | --- |
| Bus-Geschwindigkeit | 73.3 m/s |
| Bus-Flughöhe | 832 m |
| Freefall horizontal / vertikal | 14.5 m/s / 32.0 m/s |
| Gleiter horizontal / vertikal | 17.0 m/s / 7.0 m/s |
| Zwangsöffnung des Gleiters | 100 m über Terrain |

Die Konstanten stammen aus [Violevos Open-Source Fortnite-Drop-Calculator](https://github.com/Violevo/Fortnite-Drop-Calculator)
(derselbe Autor wie der FortniteHeightmapGenerator) — dort aus den Spieldaten
reverse-engineert. Die Auto-Deploy-Höhe ergänzt die von der Community konsistent
gemessenen ~100 m über Terrain.

**Warum „so viel Freefall wie möglich"?**

| | Zeit pro Höhenmeter | Zeit pro Horizontalmeter |
| --- | --- | --- |
| Freefall | 1/32 = **0.031 s** | 1/14.5 = 0.069 s |
| Gleiter | 1/7 = 0.143 s | 1/17 = **0.059 s** |

Der Gleiter spart pro Horizontalmeter nur 0.010 s, kostet aber pro Höhenmeter
0.112 s mehr. Deshalb: Sturzflug maximieren, Gleiter nur zum Strecken der
Reichweite — und genau deshalb ist der **Cut** so stark: die letzten ~100 m
am Gleiter würden 14.3 s dauern, im Freefall nur 3.1 s.

### Werte selbst testen

Über den **Regler-Button** rechts unten lassen sich alle Konstanten live
verändern; die Route rechnet sofort neu. Das Panel zeigt zusätzlich die
Phasenzeiten und wie viel der Cut gegenüber dem Durchgleiten spart — ideal, um
eigene Ingame-Messungen gegenzuprüfen. Die Defaults stehen in `src/config.ts`.

## Lokal starten

```bash
npm install
npm run dev
```

## Deployment: GitHub → Vercel

### Option A — ZIP per GitHub-Web-UI hochladen (ohne Git)

1. Den Projektordner als ZIP packen — **ohne** `node_modules/` und `dist/`
   (liegt in der `.gitignore`, Git ignoriert beide Ordner ohnehin).
2. Auf [github.com/new](https://github.com/new) ein Repo anlegen, z. B. `dropcut`
   (Public oder Private, kein README nötig).
3. Im Repo auf **„uploading an existing file"** klicken.
4. ZIP **entpacken** und alle Dateien/Ordner per Drag & Drop hochladen
   (GitHub-Web-UI kann keine ZIP-Archive direkt als Repo-Inhalt übernehmen).
5. **Commit changes** klicken.

### Option B — per Git

```bash
git init
git add .
git commit -m "DROPCUT initial"
git branch -M main
git remote add origin https://github.com/<dein-user>/dropcut.git
git push -u origin main
```

### Danach: Vercel

1. Auf [vercel.com/new](https://vercel.com/new) das GitHub-Repo importieren
2. Framework Preset: **Vite** (wird automatisch erkannt)
   Build Command: `npm run build` · Output Directory: `dist`
3. Deploy klicken — jeder Push auf `main` triggert automatisch ein neues Deployment

**Keine Env-Variablen nötig** — die App läuft komplett clientseitig
und ruft `fortnite-api.com` direkt vom Browser aus auf (CORS-offen).

## Projektstruktur

```
├── index.html
├── package.json / vite.config.ts / tsconfig.json
├── public/favicon.svg
└── src
    ├── main.tsx / App.tsx / index.css / config.ts
    ├── components/   Intro · TopBar · MapView · Panel · ProfileChart
    └── lib/          api.ts (fortnite-api.com) · terrain.ts (Höhenmodell) · dropcalc.ts (Physik)
```

## Credits

- Kartendaten & POIs: [fortnite-api.com](https://fortnite-api.com)
- Heightmap-Idee: [Violevo/FortniteHeightmapGenerator](https://github.com/Violevo/FortniteHeightmapGenerator)

*Dieses Projekt ist ein Community-Tool und steht in keiner Verbindung zu Epic Games.*
