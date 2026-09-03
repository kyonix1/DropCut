import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { head, list, put } from '@vercel/blob';

// Haelt genau EINE Discord-Nachricht aktuell. Zwei Wege:
//
//   POST /api/discord-preview   vom Editor-Browser: fertiges Bild als Body,
//                               wird sofort nach jeder Änderung geschickt
//   GET  /api/discord-preview   Fallback (z. B. externer Cron): rendert
//                               serverseitig und ueberspringt, wenn unverändert
//
// Die Nachricht besteht nur aus dem Bild.

const SIZE = 2048;
const MAP_URL = 'https://fortnite-api.com/images/map.png';
const STATE_KEY = 'dropspots/discord-state.json';
const SPOTS_PREFIX = 'dropspots/published/';
const FONT_SOURCES = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Bold.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Bold.ttf',
];
const MAX_BODY = 4_400_000; // Vercel Limit: 4.5 MB

const COLORS = {
  yellow: { stroke: '#ffd23f', fill: 'rgba(255, 210, 63, 0.38)', text: '#ffd23f' },
  red: { stroke: '#ff5757', fill: 'rgba(255, 87, 87, 0.38)', text: '#ff5757' },
};

const hasStore = () =>
  Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.VERCEL_OIDC_TOKEN
  );

// ── Font (nur fuer den serverseitigen Fallback) ─────────────────
let fontLoaded = false;
async function ensureFont() {
  if (fontLoaded) return;
  for (const url of FONT_SOURCES) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1000) {
        GlobalFonts.registerFromMemory(buf, 'MarkFont');
        fontLoaded = true;
        return;
      }
    } catch {
      /* naechste Quelle */
    }
  }
}

// ── Markierungen lesen ──────────────────────────────────────────
async function fetchJson(url) {
  try {
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function readDoc() {
  try {
    const { blobs } = await list({ prefix: SPOTS_PREFIX, limit: 100 });
    const newest = blobs
      .filter((b) => b.pathname.endsWith('.json'))
      .sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0];
    if (newest?.url) {
      const d = await fetchJson(newest.url);
      if (d && Array.isArray(d.shapes)) return d;
    }
  } catch {
    /* weiter */
  }
  return { version: 1, updatedAt: '', shapes: [] };
}

// ── Serverseitiges Rendern (Fallback) ───────────────────────────
async function renderPng(shapes) {
  await ensureFont();

  let mapImg = null;
  try {
    const r = await fetch(MAP_URL, { cache: 'no-store' });
    if (r.ok) mapImg = await loadImage(Buffer.from(await r.arrayBuffer()));
  } catch {
    /* ohne Karte */
  }

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const X = (v) => v * SIZE;

  if (mapImg) ctx.drawImage(mapImg, 0, 0, SIZE, SIZE);
  else {
    ctx.fillStyle = '#0d2a1c';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  for (const s of shapes) {
    if (!s || typeof s !== 'object') continue;
    const c = COLORS[s.color] || COLORS.yellow;
    if (s.type === 'rect' && Number.isFinite(s.x)) {
      ctx.fillStyle = c.fill;
      ctx.fillRect(X(s.x), X(s.y), X(s.w || 0), X(s.h || 0));
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 7;
      ctx.strokeRect(X(s.x), X(s.y), X(s.w || 0), X(s.h || 0));
    } else if (s.type === 'poly' && Array.isArray(s.points) && s.points.length >= 3) {
      ctx.beginPath();
      s.points.forEach((q, i) => {
        if (!q || !Number.isFinite(q.x)) return;
        if (i === 0) ctx.moveTo(X(q.x), X(q.y));
        else ctx.lineTo(X(q.x), X(q.y));
      });
      ctx.closePath();
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (s.type === 'text' && typeof s.text === 'string' && Number.isFinite(s.x)) {
      ctx.font = `bold 48px ${fontLoaded ? 'MarkFont' : 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 11;
      ctx.strokeText(s.text, X(s.x), X(s.y));
      ctx.fillStyle = c.text;
      ctx.fillText(s.text, X(s.x), X(s.y));
    }
  }

  return canvas.encode('png');
}

// ── Discord ─────────────────────────────────────────────────────
function buildForm(png, contentType) {
  const form = new FormData();
  const name = contentType && contentType.includes('jpeg') ? 'map.jpg' : 'map.png';
  form.append('files[0]', new Blob([png], { type: contentType || 'image/png' }), name);
  form.append(
    'payload_json',
    JSON.stringify({
      content: '',
      attachments: [{ id: 0, filename: name, description: 'Dropspots Karte' }],
    })
  );
  return form;
}

async function readState() {
  try {
    const meta = await head(STATE_KEY).catch(() => null);
    if (!meta?.url) return {};
    const d = await fetchJson(meta.url);
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

async function writeState(state) {
  await put(STATE_KEY, JSON.stringify(state), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

function hashShapes(shapes) {
  let h = 5381;
  const s = JSON.stringify(shapes);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Sendet das Bild: bearbeitet die vorhandene Nachricht oder sendet eine neue.
 * Wird auch von ausserhalb dieses Endpoints benutzt.
 */
export async function syncDiscordPreview(png, shapesHash, contentType) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return { ok: false, error: 'DISCORD_WEBHOOK_URL ist nicht konfiguriert' };

  const state = await readState();
  let messageId = state.messageId || null;
  let edited = false;

  if (messageId) {
    const r = await fetch(`${webhook}/messages/${messageId}`, {
      method: 'PATCH',
      body: buildForm(png, contentType),
    });
    if (r.ok) edited = true;
    else messageId = null; // Nachricht geloescht → neu senden
  }

  if (!edited) {
    const r = await fetch(`${webhook}?wait=true`, {
      method: 'POST',
      body: buildForm(png, contentType),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return { ok: false, error: `Discord ${r.status}`, detail: detail.slice(0, 200) };
    }
    const msg = await r.json();
    messageId = msg.id;
  }

  await writeState({ messageId, hash: shapesHash });
  return { ok: true, edited, messageId };
}

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!hasStore()) {
    return res.status(503).json({ error: 'Vercel Blob ist nicht mit dem Projekt verbunden' });
  }

  // ── POST: fertiges Bild vom Editor-Browser ──
  if (req.method === 'POST') {
    const required = process.env.EDIT_KEY || 'I6295jn';
    if (req.headers['x-edit-key'] !== required) {
      return res.status(401).json({ error: 'Kein Zugriff' });
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const png = Buffer.concat(chunks);
      if (!png.length) return res.status(400).json({ error: 'Kein Bild erhalten' });
      if (png.length > MAX_BODY) {
        return res.status(413).json({ error: 'Bild zu gross' });
      }

      const hash = String(req.headers['x-shapes-hash'] || '');
      const result = await syncDiscordPreview(png, hash, req.headers['content-type']);
      return res.status(result.ok ? 200 : 502).json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ── GET: Fallback, rendert serverseitig ──
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided =
        (req.headers.authorization || '').replace('Bearer ', '') || req.query.key;
      if (provided !== secret) return res.status(401).json({ error: 'Kein Zugriff' });
    }

    try {
      const doc = await readDoc();
      const hash = hashShapes(doc.shapes);
      const state = await readState();
      const force = req.query.force === '1' || req.query.force === 'true';

      if (!force && state.hash === hash && state.messageId) {
        return res.status(200).json({ ok: true, unchanged: true, messageId: state.messageId });
      }

      const png = await renderPng(doc.shapes);
      const result = await syncDiscordPreview(png, hash, 'image/png');
      return res.status(result.ok ? 200 : 502).json({ ...result, shapes: doc.shapes.length });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res.status(405).json({ error: 'Methode nicht erlaubt' });
}
