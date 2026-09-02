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
**Rückgängig:** Undo-Button oder **Strg+Z** · **Reset** verwirft alles Ungespeicherte.
**Karte bewegen:** Ziehen oder **mittlere Maustaste** (funktioniert in jedem Werkzeug).

## Änderungsanfragen (Requests)

Besucher ohne Key können Änderungen **vorschlagen**:

1. Button **Request** rechts oben
2. Mit denselben Werkzeugen zeichnen — die Karte zeigt bestehende Spots abgeblendet
3. **Abschicken** → kurze Beschreibung eingeben → fertig

Die Anfrage ändert noch nichts an der Karte.

Im Editor-Modus erscheint ein **Posteingang** mit der Anzahl offener Anfragen:

- **Auge** — zeigt nur diese eine Anfrage allein auf der Karte
- **Annehmen** — übernimmt die Objekte und speichert sofort
- **Ablehnen** — verwirft die Anfrage
- **Alle ablehnen** — leert den Posteingang

## Speichern

Der **Speichern**-Button sichert die Änderungen direkt auf der Website —
kein Download, kein Deployment. Gespeichert wird über die mitgelieferte
Server-Route `api/spots.js`.

### Einmalige Einrichtung in Vercel

1. Im Vercel-Projekt auf **Storage → Create Database → Blob**
2. Den Blob-Store mit dem Projekt verbinden (Connect Project)
3. Neu deployen

Vercel setzt dabei automatisch `BLOB_READ_WRITE_TOKEN`. Ab dann speichert der
Button für **alle Besucher sichtbar**, und die Markierungen bleiben nach einem
Reload erhalten.

**Ohne Blob-Store** funktioniert die Seite trotzdem: Es wird im Browser
(localStorage) gespeichert und der Hinweis „Gespeichert (nur lokal)" angezeigt.

### Schreibschutz (empfohlen)

Der Editor-Key im Frontend schützt nur die Oberfläche. Für echten Schutz in
Vercel unter **Settings → Environment Variables** setzen:

```
EDIT_KEY = I6295jn
```

Dann akzeptiert der Server nur noch Anfragen mit diesem Key.

**Ladereihenfolge:** Server → `public/spots.json` → lokale Kopie
(der neueste Stand gewinnt).

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
