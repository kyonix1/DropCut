// ─── DROPSPOTS · Konfiguration ───────────────────────────────────────────────

/** Die Map-Textur deckt die Welt von -131072cm bis +131072cm ab. */
export const WORLD = {
  HALF_CM: 131072,
  SIZE_M: 2621.44,
};

export const API = {
  MAP: 'https://fortnite-api.com/v1/map',
  MAP_LANG: 'https://fortnite-api.com/v1/map?language=de',
};

/** Zugriffsschlüssel für den Bearbeitungsmodus */
export const EDIT_KEY = 'I6295jn';

export interface Norm {
  x: number; // 0..1
  y: number; // 0..1
}

export const lerpNorm = (a: Norm, b: Norm, t: number): Norm => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
