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
// 1. Remote-API (falls VITE_SPOTS_API gesetzt) — für alle sichtbar, live
// 2. public/spots.json — die im Repo veröffentlichte Version (für alle sichtbar)
// 3. localStorage — lokale Arbeitskopie
//
// Ohne Remote-API bleibt der Save-Button voll funktionsfähig: er speichert
// lokal und liefert die JSON-Datei zum Ablegen unter public/spots.json.

const LS_KEY = 'dropspots_doc_v1';
const REMOTE: string | undefined = (import.meta as { env?: Record<string, string> }).env?.VITE_SPOTS_API;

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
  // 1. Remote
  if (REMOTE) {
    try {
      const r = await fetch(REMOTE, { cache: 'no-store' });
      if (r.ok) return { doc: sanitize(await r.json()), source: 'remote' };
    } catch {
      /* weiter */
    }
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

  if (local && published) {
    return local.updatedAt > published.updatedAt
      ? { doc: local, source: 'local' }
      : { doc: published, source: 'published' };
  }
  if (local) return { doc: local, source: 'local' };
  if (published) return { doc: published, source: 'published' };
  return { doc: emptyDoc(), source: 'empty' };
}

export interface SaveResult {
  ok: boolean;
  remote: boolean;
  message: string;
}

export async function saveDoc(doc: SpotDoc): Promise<SaveResult> {
  const payload: SpotDoc = { ...doc, updatedAt: new Date().toISOString() };

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* Speicher voll o. ä. */
  }

  if (REMOTE) {
    try {
      const r = await fetch(REMOTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) return { ok: true, remote: true, message: 'Für alle veröffentlicht' };
      return { ok: false, remote: true, message: `Server ${r.status}` };
    } catch {
      return { ok: false, remote: true, message: 'Server nicht erreichbar' };
    }
  }

  return { ok: true, remote: false, message: 'Lokal gespeichert · JSON geladen' };
}

/** spots.json herunterladen, um sie im Repo zu veröffentlichen */
export function downloadDoc(doc: SpotDoc) {
  const payload: SpotDoc = { ...doc, updatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spots.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
