import { head, put } from '@vercel/blob';

// Serverless-Speicher für die Dropspot-Markierungen.
//
//   GET   /api/spots  → aktuelle Markierungen (JSON)
//   POST  /api/spots  → Markierungen speichern (JSON im Body)
//
// Speicher: Vercel Blob. Dafür in Vercel unter Storage einen Blob-Store
// anlegen und mit dem Projekt verbinden — die Variable BLOB_READ_WRITE_TOKEN
// wird dann automatisch gesetzt.
//
// Schreibschutz: optional die Umgebungsvariable EDIT_KEY setzen. Ist sie
// gesetzt, muss der Client denselben Key im Header x-edit-key senden.

const BLOB_NAME = 'dropspots/spots.json';
const EMPTY = { version: 1, updatedAt: '', shapes: [] };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-edit-key');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  // ── Lesen ──
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (!hasBlob) return res.status(200).json(EMPTY);
    try {
      const meta = await head(BLOB_NAME).catch(() => null);
      if (!meta?.url) return res.status(200).json(EMPTY);
      const r = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return res.status(200).json(EMPTY);
      return res.status(200).json(await r.json());
    } catch {
      return res.status(200).json(EMPTY);
    }
  }

  // ── Schreiben ──
  if (req.method === 'POST') {
    const required = process.env.EDIT_KEY;
    if (required && req.headers['x-edit-key'] !== required) {
      return res.status(401).json({ error: 'Kein Zugriff' });
    }
    if (!hasBlob) {
      return res.status(503).json({ error: 'Kein Blob-Store verbunden' });
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.shapes)) {
        return res.status(400).json({ error: 'Ungültige Daten' });
      }
      const doc = {
        version: 1,
        updatedAt: new Date().toISOString(),
        shapes: body.shapes.slice(0, 5000),
      };
      await put(BLOB_NAME, JSON.stringify(doc), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true, updatedAt: doc.updatedAt });
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }

  return res.status(405).json({ error: 'Methode nicht erlaubt' });
}
