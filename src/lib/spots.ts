import { Norm } from '../config';

// ─── Datenmodell ─────────────────────────────────────────────────────────────

export type MarkColor = 'yellow' | 'red';

export const COLORS: Record<MarkColor, { stroke: string; fill: string; text: string; label: string }> = {
  yellow: { stroke: '#ffd23f', fill: 'rgba(255, 210, 63, 0.38)', text: '#ffd23f', label: 'Gelb' },
  red: { stroke: '#ff5757', fill: 'rgba(255, 87, 87, 0.38)', text: '#ff5757', label: 'Rot' },
};

export interface RectShape {
  id: string;
  type: 'rect';
  color: MarkColor;
  /** normalisierte Eckpunkte (0..1) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PolyShape {
  id: string;
  type: 'poly';
  color: MarkColor;
  points: Norm[];
}

export interface TextShape {
  id: string;
  type: 'text';
  color: MarkColor;
  x: number;
  y: number;
  text: string;
}

export type Shape = RectShape | PolyShape | TextShape;

export interface SpotDoc {
  version: number;
  updatedAt: string;
  shapes: Shape[];
}

export const emptyDoc = (): SpotDoc => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  shapes: [],
});

export const newId = () => Math.random().toString(36).slice(2, 10);

// ─── Persistenz ──────────────────────────────────────────────────────────────
//
// Speichern geht immer direkt auf der Website:
//   1. /api/spots  — Server-Route (für alle Besucher sichtbar)
//   2. localStorage — Fallback, falls kein Server verfügbar ist
//
// Geladen wird: Server → public/spots.json → lokale Kopie (neueste gewinnt).

const LS_KEY = 'dropspots_doc_v1';
const REMOTE: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_SPOTS_API || '/api/spots';

function sanitize(raw: unknown): SpotDoc {
  const d = raw as Partial<SpotDoc> | null;
  if (!d || !Array.isArray(d.shapes)) return emptyDoc();
  const shapes = d.shapes.filter((s): s is Shape => {
    if (!s || typeof s !== 'object') return false;
    const t = (s as Shape).type;
    return t === 'rect' || t === 'poly' || t === 'text';
  });
  return {
    version: typeof d.version === 'number' ? d.version : 1,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
    shapes,
  };
}

export async function loadDoc(): Promise<{ doc: SpotDoc; source: 'remote' | 'published' | 'local' | 'empty' }> {
  // 1. Server
  let remote: SpotDoc | null = null;
  try {
    const r = await fetch(REMOTE, { cache: 'no-store' });
    if (r.ok) {
      const d = sanitize(await r.json());
      if (d.shapes.length > 0 || d.updatedAt) remote = d;
    }
  } catch {
    /* weiter */
  }

  // 2. veröffentlichte Datei im Repo
  let published: SpotDoc | null = null;
  try {
    const r = await fetch(`spots.json?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) published = sanitize(await r.json());
  } catch {
    /* weiter */
  }

  // 3. lokale Arbeitskopie — nur wenn neuer als die veröffentlichte
  let local: SpotDoc | null = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) local = sanitize(JSON.parse(raw));
  } catch {
    /* weiter */
  }

  // Neuesten Stand gewinnen lassen
  const cands: { doc: SpotDoc; source: 'remote' | 'published' | 'local' }[] = [];
  if (remote) cands.push({ doc: remote, source: 'remote' });
  if (published) cands.push({ doc: published, source: 'published' });
  if (local) cands.push({ doc: local, source: 'local' });
  if (cands.length === 0) return { doc: emptyDoc(), source: 'empty' };

  cands.sort((a, b) => (b.doc.updatedAt || '').localeCompare(a.doc.updatedAt || ''));
  return cands[0];
}

export interface SaveResult {
  ok: boolean;
  remote: boolean;
  message: string;
}

export async function saveDoc(doc: SpotDoc, editKey?: string): Promise<SaveResult> {
  const payload: SpotDoc = { ...doc, updatedAt: new Date().toISOString() };

  // Immer lokal sichern, damit nichts verloren geht
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* Speicher voll o. ä. */
  }

  // Auf dem Server veröffentlichen
  try {
    const r = await fetch(REMOTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(editKey ? { 'x-edit-key': editKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (r.ok) return { ok: true, remote: true, message: 'Gespeichert · für alle sichtbar' };
    if (r.status === 503) return { ok: true, remote: false, message: 'Gespeichert (nur lokal)' };
    if (r.status === 401) return { ok: false, remote: true, message: 'Kein Schreibrecht' };
    return { ok: true, remote: false, message: 'Gespeichert (nur lokal)' };
  } catch {
    return { ok: true, remote: false, message: 'Gespeichert (nur lokal)' };
  }
}
