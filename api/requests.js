import { del, list, put } from '@vercel/blob';

// Jede Anfrage liegt als eigener, unveraenderlicher Blob. Dadurch gehen bei
// gleichzeitigen Einsendungen keine Requests durch "last write wins" verloren.
const PREFIX = 'dropspots/requests/';

const hasStore = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.VERCEL_OIDC_TOKEN
  );

async function readAll() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const rows = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const response = await fetch(blob.url, { cache: 'no-store' });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    })
  );
  return rows
    .filter((item) => item && typeof item.id === 'string' && Array.isArray(item.shapes))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function requireEditor(req, res) {
  const required = process.env.EDIT_KEY;
  if (required && req.headers['x-edit-key'] !== required) {
    res.status(401).json({ error: 'Kein Zugriff' });
    return false;
  }
  return true;
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
      return res.status(200).json({ requests: await readAll() });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Methode nicht erlaubt' });
    }

    const action = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;
    if (action) {
      if (!requireEditor(req, res)) return;
      const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;

      if (action === 'rejectAll') {
        const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
        if (blobs.length) await del(blobs.map((blob) => blob.url));
        return res.status(200).json({ ok: true });
      }

      if ((action === 'reject' || action === 'remove') && id) {
        const safeId = String(id).replace(/[^a-z0-9-]/gi, '');
        if (!safeId) return res.status(400).json({ error: 'Ungueltige ID' });
        await del(`${PREFIX}${safeId}.json`);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unbekannte Aktion' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!Array.isArray(body.shapes) || body.shapes.length === 0) {
      return res.status(400).json({ error: 'Keine Aenderungen enthalten' });
    }

    const { blobs } = await list({ prefix: PREFIX, limit: 201 });
    if (blobs.length >= 200) {
      return res.status(429).json({ error: 'Zu viele offene Anfragen' });
    }

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const entry = {
      id,
      createdAt: new Date().toISOString(),
      note: typeof body.note === 'string' ? body.note.slice(0, 200) : '',
      shapes: body.shapes.slice(0, 500),
    };

    await put(`${PREFIX}${id}.json`, JSON.stringify(entry), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    });
    return res.status(200).json({ ok: true, id });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}