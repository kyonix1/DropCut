# DROPSPOTS — Fortnite Spot Marker

Ein Marker-Tool für die aktuelle Fortnite-Map. Besucher sehen die veröffentlichten
Markierungen, Berechtigte können sie mit einem Key bearbeiten.

Kartendaten live von [fortnite-api.com](https://fortnite-api.com).

## Bedienung

**Ansicht (alle)** — Karte ziehen, Mausrad oder die Buttons unten rechts zum Zoomen.

**Bearbeiten** — Schloss-Button oben rechts → Key eingeben → Werkzeugleiste erscheint oben.

| Werkzeug | Bedienung |
| --- | --- |
| **Bewegen** | Karte ziehen, Form anklicken zum Auswählen, Auswahl verschieben |
| **Rechteck** | Aufziehen |
| **Polygon** | Punkte klicken, **Doppelklick** oder **Enter** schließt ab, **Esc** bricht ab |
| **Text** | Position klicken, Text eingeben |

**Farben:** Gelb und Rot, jeweils halbtransparent gefüllt.
**Löschen:** Form auswählen → Papierkorb oder **Entf**.

## Speichern & Veröffentlichen

Der **Speichern**-Button legt die Markierungen immer lokal ab. Wie sie für *alle*
sichtbar werden, hängt von der Konfiguration ab:

### Variante A — ohne Backend (Standard)

Speichern lädt eine `spots.json` herunter. Diese Datei nach
`public/spots.json` im Repository legen und committen — Vercel deployt
automatisch, danach sehen alle Besucher die Markierungen.

```bash
# heruntergeladene Datei ersetzen
mv ~/Downloads/spots.json public/spots.json
git add public/spots.json
git commit -m "Update dropspots"
git push
```

### Variante B — mit Live-Backend

Eine Umgebungsvariable in Vercel setzen:

```
VITE_SPOTS_API = https://dein-endpoint/spots
```

Der Endpoint muss `GET` (JSON zurückgeben) und `POST` (JSON speichern)
unterstützen. Dann speichert der Button direkt live für alle — ohne Deployment.
Geeignet sind z. B. Vercel KV mit einer kleinen `/api`-Route, Supabase oder
jeder andere JSON-Store.

**Ladereihenfolge:** Remote-API → `public/spots.json` → lokale Arbeitskopie
(die lokale Version gewinnt nur, wenn sie neuer ist).

## Editor-Key

Der Key steht in `src/config.ts`:

```ts
export const EDIT_KEY = 'I6295jn';
```

Er schützt nur die Oberfläche, nicht die Daten — bei Variante B sollte der
Endpoint zusätzlich serverseitig abgesichert werden.

## Lokal starten

```bash
npm install
npm run dev
```

## Deployment (GitHub → Vercel)

1. Repo auf GitHub pushen (ohne `node_modules/` und `dist/`)
2. Auf [vercel.com/new](https://vercel.com/new) importieren
3. Framework **Vite** wird erkannt · Build `npm run build` · Output `dist`

*Community-Tool, nicht mit Epic Games verbunden.*
