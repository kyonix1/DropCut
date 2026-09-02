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
   und einen **Public Blob Store** anlegen
2. Den Blob-Store mit dem Projekt verbinden (Connect Project)
3. Neu deployen

Vercel setzt dabei automatisch `BLOB_READ_WRITE_TOKEN`. Ab dann speichert der
Button für **alle Besucher sichtbar**, und die Markierungen bleiben nach einem
Reload erhalten.

Die Requests werden als einzelne Dateien unter `dropspots/requests/` gespeichert.
Dadurch koennen mehrere Besucher gleichzeitig Anfragen senden, ohne sich
gegenseitig zu ueberschreiben. Der Editor aktualisiert den Posteingang alle
15 Sekunden und beim Zurueckkehren in den Browser-Tab.

Nach Aenderungen an den API-Dateien muss das Projekt **neu deployed** werden.
Der direkte Test `https://DEINE-DOMAIN.vercel.app/api/requests` muss danach
`{"requests":[]}` (oder eine Liste) liefern. Ein Fehler 503 bedeutet, dass der
Blob Store noch nicht mit genau diesem Vercel-Projekt verbunden ist.

**Es gibt bewusst keinen lokalen Speicher.** Der Server ist die einzige Quelle
der Wahrheit: Was gespeichert wird, sehen alle Besucher. Schlägt das Speichern
fehl, erscheint eine klare Fehlermeldung und die Änderung gilt weiterhin als
ungespeichert — sie wird also nicht fälschlich nur bei dir angezeigt.

Ohne verbundenen Blob-Store meldet der Speichern-Button
„Nicht veröffentlicht · Blob-Store fehlt".

Besucher sehen veröffentlichte Änderungen automatisch: Die Karte aktualisiert
sich alle 20 Sekunden und beim Zurückkehren in den Browser-Tab.

## Discord Map Preview

Einmal pro Minute wird die Karte mit allen Markierungen als Bild in einen
Discord-Channel gesendet. Die Nachricht besteht **nur aus dem Bild** und wird
nach dem ersten Senden bei jeder Änderung **bearbeitet** statt neu gesendet.

```
api/discord-preview.js   rendert das PNG und hält die Discord-Nachricht aktuell
```

### Einrichtung

1. **Webhook** — in Discord: Kanal bearbeiten → Integrationen → Webhook
2. In Vercel unter **Settings → Environment Variables** setzen:
   ```text
   DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/…/…
   ```
3. Neu deployen

Der Webhook steht aus Sicherheitsgruenden nicht im Quellcode. Falls ein Webhook
einmal im Code, Chat oder GitHub-Repository veroeffentlicht wurde, muss er in
Discord geloescht und neu erstellt werden.

### Testen

```text
https://DEINE-DOMAIN.vercel.app/api/discord-preview?force=1
```

Antwort:

```json
{ "ok": true, "edited": false, "messageId": "…", "shapes": 3 }
```

- `edited: false` → erste Nachricht wurde gesendet
- `edited: true` → vorhandene Nachricht wurde aktualisiert
- `unchanged: true` → es gab keine Änderung, nichts gesendet

### Jede Minute auf Vercel Hobby

Nutze kostenlos [cron-job.org](https://cron-job.org):

1. Konto erstellen und **Create Cronjob** anklicken
2. URL: `https://DEINE-DOMAIN.vercel.app/api/discord-preview?key=DEIN_CRON_SECRET`
3. Ausfuehrung: **Every minute**
4. Request Method: **GET**
5. Speichern und aktivieren

Der Endpoint bearbeitet stets dieselbe Nachricht und ueberspringt den Discord-
Aufruf komplett, wenn sich die Karte nicht geaendert hat.

### Schutz des Endpoints

Optional in Vercel setzen:

```text
CRON_SECRET = irgendein-geheimes-wort
```

Dann akzeptiert der Endpoint nur Anfragen mit `Authorization: Bearer …` oder
`?key=…`. Vercel-Crons senden diesen Header automatisch. Bei einem externen
Cron die URL dann als `…?key=irgendein-geheimes-wort` hinterlegen.

Der Status (welche Discord-Nachricht bearbeitet wird) liegt unter
`dropspots/discord-state.json` im Blob-Store — dadurch überlebt er Neustarts.

Wird die Discord-Nachricht manuell gelöscht, erkennt der Endpoint das beim
nächsten Lauf und sendet automatisch eine neue.

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
