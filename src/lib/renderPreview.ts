import { COLORS, Shape } from './spots';

// ─── Vorschau rendern (Client) ───────────────────────────────────────────────
//
// Das Bild wird im Browser des Editors gerendert. Vorteil: Fonts sind
// verfuegbar (Text inkl. schwarzem Umriss sieht exakt aus wie auf der Karte)
// und der Server muss kein Canvas und keine Schriftdatei laden.

const SIZE = 2048;
const PNG_LIMIT = 3_200_000; // Vercel erlaubt max. 4.5 MB Request-Body

/** Fingerprint der Formen — der Server speichert ihn, um Dubletten zu sparen */
export function hashShapes(shapes: Shape[]): string {
  let h = 5381;
  const s = JSON.stringify(shapes);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas-Export fehlgeschlagen'))),
      type,
      quality
    );
  });
}

async function loadMap(url: string): Promise<HTMLImageElement | null> {
  try {
    // ueber Blob laden, damit die Canvas nicht "tainted" wird und der
    // Export per toBlob nicht an der Same-Origin-Policy scheitert
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Karte nicht ladbar'));
        img.src = objUrl;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
    }
  } catch {
    return null;
  }
}

/** Rendert Karte + alle Formen (Rechtecke, Polygone, Text) als Bild */
export async function renderPreview(shapes: Shape[], mapUrl: string | null): Promise<Blob> {
  // warten, bis die UI-Font geladen ist, damit Text sicher gerendert wird
  try {
    await document.fonts.ready;
  } catch {
    /* weiter */
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  const X = (v: number) => v * SIZE;

  if (mapUrl) {
    const img = await loadMap(mapUrl);
    if (img) ctx.drawImage(img, 0, 0, SIZE, SIZE);
  }
  if (!mapUrl) {
    ctx.fillStyle = '#0d2a1c';
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  for (const s of shapes) {
    if (!s || typeof s !== 'object') continue;
    const c = COLORS[s.color] || COLORS.yellow;

    if (s.type === 'rect') {
      ctx.fillStyle = c.fill;
      ctx.fillRect(X(s.x), X(s.y), X(s.w), X(s.h));
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 7;
      ctx.strokeRect(X(s.x), X(s.y), X(s.w), X(s.h));
    } else if (s.type === 'poly' && s.points.length >= 3) {
      ctx.beginPath();
      s.points.forEach((q, i) => (i === 0 ? ctx.moveTo(X(q.x), X(q.y)) : ctx.lineTo(X(q.x), X(q.y))));
      ctx.closePath();
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (s.type === 'text' && s.text) {
      ctx.font = '700 48px Inter, "Segoe UI", sans-serif';
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

  const png = await toBlob(canvas, 'image/png');
  if (png.size <= PNG_LIMIT) return png;
  // sehr grosse Karten als JPEG ausliefern (Discord zeigt beides an)
  return toBlob(canvas, 'image/jpeg', 0.95);
}

/** Rendert und pusht die Vorschau sofort nach einer Änderung */
export async function pushPreview(
  shapes: Shape[],
  mapUrl: string | null,
  editKey: string
): Promise<boolean> {
  if (shapes.length === 0 && !mapUrl) return false;
  const blob = await renderPreview(shapes, mapUrl);

  const res = await fetch('/api/discord-preview', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'image/png',
      'x-edit-key': editKey,
      'x-shapes-hash': hashShapes(shapes),
    },
    body: blob,
  });
  return res.ok;
}
