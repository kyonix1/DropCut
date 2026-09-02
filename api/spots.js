import { del, head, list, put } from '@vercel/blob';

// Versionierte Dateien statt eines ueberschriebenen CDN-Pfads. So liefert GET
// sofort die neueste Version und nicht bis zu 60 Sekunden alte Daten.
const PREFIX = 'dropspots/published/';
const LEGACY_NAME = 'dropspots/spots.json';
const EMPTY = { version: 1, updatedAt: '', shapes: [] };

const hasStore = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.VERCEL_OIDC_TOKEN
  );

async function readLatest() {
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  const sorted = blobs.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  if (sorted[0]?.url) {
    const response = await fetch(sorted[0].url, { cache: 'no-store' });
    if (response.ok) return response.json();
  }

  const legacy = await head(LEGACY_NAME).catch(() => null);
  if (legacy?.url) {
    const response = await fetch(legacy.url, { cache: 'no-store' });
    if (response.ok) return response.json();
  }
  return EMPTY;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-edit-key');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!hasStore()) {
    return res.status(503).json({ error: 'Vercel Blob ist nicht mit dem Projekt verbunden' });
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await readLatest());
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Methode nicht erlaubt' });
    }

    const required = process.env.EDIT_KEY;
    if (required && req.headers['x-edit-key'] !== required) {
      return res.status(401).json({ error: 'Kein Zugriff' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.shapes)) {
      return res.status(400).json({ error: 'Ungueltige Daten' });
    }

    const doc = {
      version: 1,
      updatedAt: new Date().toISOString(),
      shapes: body.shapes.slice(0, 5000),
    };
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await put(`${PREFIX}${id}.json`, JSON.stringify(doc), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    });

    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const old = blobs
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(10);
    if (old.length) await del(old.map((blob) => blob.url));

    return res.status(200).json({ ok: true, updatedAt: doc.updatedAt });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}