import { head, put } from '@vercel/blob';

// Änderungsanfragen (Requests) von Besuchern.
//
//   GET   /api/requests            → alle offenen Anfragen
//   POST  /api/requests            → neue Anfrage einreichen (offen für alle)
//   POST  /api/requests?action=... → verwalten (nur mit Editor-Key)
//         action=reject&id=…       → eine Anfrage ablehnen
//         action=rejectAll         → alle ablehnen
//         action=remove&id=…       → nach dem Annehmen entfernen

const BLOB_NAME = 'dropspots/requests.json';

async function readAll() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const meta = await head(BLOB_NAME).catch(() => null);
    if (!meta?.url) return [];
    const r = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d?.requests) ? d.requests : [];
  } catch {
    return [];
  }
}

async function writeAll(requests) {
  await put(BLOB_NAME, JSON.stringify({ requests }), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-edit-key');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ requests: await readAll() });
  }

  if (req.method === 'POST') {
    if (!hasBlob) return res.status(503).json({ error: 'Kein Blob-Store verbunden' });

    const action = req.query?.action;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    // ── Verwaltung: Editor-Key nötig ──
    if (action) {
      const required = process.env.EDIT_KEY;
      if (required && req.headers['x-edit-key'] !== required) {
        return res.status(401).json({ error: 'Kein Zugriff' });
      }
      let list = await readAll();
      if (action === 'rejectAll') list = [];
      else if (action === 'reject' || action === 'remove') {
        const id = req.query.id;
        list = list.filter((r) => r.id !== id);
      } else {
        return res.status(400).json({ error: 'Unbekannte Aktion' });
      }
      await writeAll(list);
      return res.status(200).json({ ok: true, requests: list });
    }

    // ── Neue Anfrage einreichen ──
    if (!Array.isArray(body.shapes) || body.shapes.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen enthalten' });
    }
    const list = await readAll();
    if (list.length >= 200) return res.status(429).json({ error: 'Zu viele offene Anfragen' });

    const entry = {
      id: Math.random().toString(36).slice(2, 10),
      createdAt: new Date().toISOString(),
      note: typeof body.note === 'string' ? body.note.slice(0, 200) : '',
      shapes: body.shapes.slice(0, 500),
    };
    list.push(entry);
    await writeAll(list);
    return res.status(200).json({ ok: true, id: entry.id });
  }

  return res.status(405).json({ error: 'Methode nicht erlaubt' });
}
