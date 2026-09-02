// ─── DROPCUT · zentrale Konfiguration ────────────────────────────────────────

/** Die Map-Textur ist 2048px und deckt die Welt von -131072cm bis +131072cm ab. */
export const WORLD = {
  HALF_CM: 131072,
  IMG_SIZE: 2048,
  /** Weltgröße in Metern über die komplette Map-Textur (2621.44 m) */
  SIZE_M: 2621.44,
};

export const API = {
  MAP: 'https://fortnite-api.com/v1/map',
  MAP_LANG: 'https://fortnite-api.com/v1/map?language=de',
  HEIGHTMAP_RAW:
    'https://raw.githubusercontent.com/Violevo/FortniteHeightmapGenerator/main/images/heightmap.png',
};

/**
 * Flugphysik.
 *
 * Basis sind die reverse-engineerten Konstanten aus Violevos Open-Source
 * "Fortnite-Drop-Calculator" (derselbe Autor wie der FortniteHeightmapGenerator):
 *
 *   v_bus = 73.3 m/s · H_bus = 832 m
 *   v_fall_h = 14.5 m/s · v_fall_v = 32.0 m/s     (Skydive / Freefall)
 *   v_glide_h = 17.0 m/s · v_glide_v = 7.0 m/s    (Gleiter)
 *
 * Ergänzt um die Zwangsöffnung des Gleiters, die von der Community konsistent
 * mit ~100 m über dem Terrain angegeben wird — genau diese Phase wird beim
 * Glider-Cut weggeschnitten.
 *
 * Ablauf: BUS → JUMP → Freefall → DEPLOY (Gleiter) → CUT → Freefall → Landung
 */
export interface Phys {
  busSpeed: number;
  busAlt: number;
  fallH: number;
  fallV: number;
  glideH: number;
  glideV: number;
  autoDeploy: number;
}

export const DEFAULT_PHYS: Phys = {
  busSpeed: 73.3,
  busAlt: 832,
  fallH: 14.5,
  fallV: 32.0,
  glideH: 17.0,
  glideV: 7.0,
  autoDeploy: 100,
};

export const PHYS_FIELDS: { key: keyof Phys; label: string; unit: string; step: number }[] = [
  { key: 'busSpeed', label: 'Bus Speed', unit: 'm/s', step: 0.1 },
  { key: 'busAlt', label: 'Bus Altitude', unit: 'm', step: 1 },
  { key: 'fallH', label: 'Freefall horiz.', unit: 'm/s', step: 0.1 },
  { key: 'fallV', label: 'Freefall vert.', unit: 'm/s', step: 0.1 },
  { key: 'glideH', label: 'Glider horiz.', unit: 'm/s', step: 0.1 },
  { key: 'glideV', label: 'Glider vert.', unit: 'm/s', step: 0.1 },
  { key: 'autoDeploy', label: 'Auto-Deploy', unit: 'm', step: 1 },
];

export const TERRAIN_CLEAR = 5; // m Mindestabstand der Flugbahn zum Terrain

export type Stage = 'loading' | 'spot' | 'routeA' | 'routeB' | 'done';

export interface Norm {
  x: number; // 0..1 Map-Fraktion (West→Ost)
  y: number; // 0..1 Map-Fraktion (Nord→Süd)
}

export const normToM = (a: Norm, b: Norm) => {
  const dx = (a.x - b.x) * WORLD.SIZE_M;
  const dy = (a.y - b.y) * WORLD.SIZE_M;
  return Math.hypot(dx, dy);
};

export const lerpNorm = (a: Norm, b: Norm, t: number): Norm => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const fmtM = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

export const fmtS = (s: number) => `${s.toFixed(1)} s`;
