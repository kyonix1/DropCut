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
// Der Server ist die einzige Quelle der Wahrheit. Es gibt bewusst KEINEN
// lokalen Speicher: Was gespeichert wird, sehen alle Besucher — und was nicht
// gespeichert werden konnte, wird auch lokal nicht als gespeichert angezeigt.
//
// Geladen wird: /api/spots → public/spots.json (Startbestand im Repo).

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

export async function loadDoc(): Promise<{
  doc: SpotDoc;
  source: 'remote' | 'published' | 'empty';
}> {
  // 1. Server — der veroeffentlichte Stand fuer alle
  try {
    const r = await fetch(REMOTE, { cache: 'no-store' });
    if (r.ok) {
      const d = sanitize(await r.json());
      if (d.shapes.length > 0 || d.updatedAt) return { doc: d, source: 'remote' };
    }
  } catch {
    /* weiter zum Startbestand */
  }

  // 2. Startbestand aus dem Repo
  try {
    const r = await fetch(`spots.json?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) {
      const d = sanitize(await r.json());
      if (d.shapes.length > 0) return { doc: d, source: 'published' };
    }
  } catch {
    /* leer starten */
  }

  return { doc: emptyDoc(), source: 'empty' };
}

export interface SaveResult {
  ok: boolean;
  remote: boolean;
  message: string;
  /** Der vom Server bestaetigte Stand, den jetzt alle sehen */
  doc?: SpotDoc;
}

export async function saveDoc(doc: SpotDoc, editKey?: string): Promise<SaveResult> {
  const payload: SpotDoc = { ...doc, updatedAt: new Date().toISOString() };

  // Ausschliesslich auf dem Server veroeffentlichen
  try {
    const r = await fetch(REMOTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(editKey ? { 'x-edit-key': editKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      // Zur Sicherheit den tatsaechlich veroeffentlichten Stand zurueckholen
      const verified = await loadDoc();
      return {
        ok: true,
        remote: true,
        message: 'Veröffentlicht · für alle sichtbar',
        doc: verified.source === 'remote' ? verified.doc : payload,
      };
    }
    const d = await r.json().catch(() => null);
    if (r.status === 503) {
      return {
        ok: false,
        remote: false,
        message: d?.error || 'Nicht veroeffentlicht · Blob-Store fehlt',
      };
    }
    if (r.status === 401) return { ok: false, remote: true, message: 'Kein Schreibrecht' };
    return {
      ok: false,
      remote: false,
      message: d?.error || `Nicht gespeichert (Server ${r.status})`,
    };
  } catch {
    return { ok: false, remote: false, message: 'Nicht veroeffentlicht · Server nicht erreichbar' };
  }
}

// ─── Änderungsanfragen ───────────────────────────────────────────────────────

export interface SpotRequest {
  id: string;
  createdAt: string;
  note: string;
  shapes: Shape[];
}

const REQ_API: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_REQUESTS_API || '/api/requests';

export interface RequestsResult {
  requests: SpotRequest[];
  remote: boolean;
  error?: string;
}

export async function loadRequests(): Promise<RequestsResult> {
  try {
    const r = await fetch(REQ_API, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      return {
        requests: Array.isArray(d?.requests) ? d.requests : [],
        remote: true,
      };
    }
    const d = await r.json().catch(() => null);
    return {
      requests: [],
      remote: false,
      error: d?.error || `Request-Server: ${r.status}`,
    };
  } catch {
    return {
      requests: [],
      remote: false,
      error: 'Request-Server nicht erreichbar',
    };
  }
}

export async function submitRequest(
  shapes: Shape[],
  note: string
): Promise<{ ok: boolean; remote: boolean; message: string }> {
  try {
    const r = await fetch(REQ_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shapes, note }),
    });
    if (r.ok) return { ok: true, remote: true, message: 'Anfrage gesendet' };
    const d = await r.json().catch(() => null);
    return {
      ok: false,
      remote: false,
      message: d?.error || `Anfrage nicht gesendet (Server ${r.status})`,
    };
  } catch {
    return {
      ok: false,
      remote: false,
      message: 'Anfrage nicht gesendet · Server nicht erreichbar',
    };
  }
}

async function manageRequest(action: string, id: string | null, editKey: string): Promise<boolean> {
  const url = `${REQ_API}?action=${action}${id ? `&id=${encodeURIComponent(id)}` : ''}`;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'x-edit-key': editKey } });
    if (r.ok) return true;
  } catch {
    /* Fehler wird an die UI weitergegeben */
  }
  return false;
}

export const rejectRequest = (id: string, key: string) => manageRequest('reject', id, key);
export const removeRequest = (id: string, key: string) => manageRequest('remove', id, key);
export const rejectAllRequests = (key: string) => manageRequest('rejectAll', null, key);
