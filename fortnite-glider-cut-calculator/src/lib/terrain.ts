import { useEffect, useRef, useState } from 'react';
import { API } from '../config';
import type { MapData } from './api';

// ─── Terrain-Modell ──────────────────────────────────────────────────────────
// Primär: Inverse-Distance-Weighting über die echten POI-Höhen (z) der aktuellen
// Season von fortnite-api.com + deterministisches Fein-Relief.
// Optional: Auto-kalibrierter Blend mit der Heightmap aus dem
// Violevo/FortniteHeightmapGenerator-Repo (Least-Squares-Fit auf die POI-Höhen).

const GRID = 200;

export type TerrainSource = 'poi' | 'remote' | 'blend';

export interface TerrainState {
  ready: boolean;
  grid: Float32Array | null;
  remote: Float32Array | null; // kalibrierte Remote-Höhen (m)
  remoteStatus: 'loading' | 'ok' | 'fail';
  remoteR2: number | null;
  source: TerrainSource;
}

// deterministisches Value-Noise für Fein-Relief
function hash(ix: number, iy: number): number {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 10000) / 10000;
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function reliefNoise(nx: number, ny: number): number {
  const o1 = vnoise(nx * 22, ny * 22) - 0.5;
  const o2 = vnoise(nx * 61 + 9.2, ny * 61 + 4.7) - 0.5;
  return o1 * 7 + o2 * 3.2; // ±10 m Fein-Relief
}

/** IDW-Gitter aus den POI-Höhen + virtuelle Meerespunkte an den Map-Rändern */
export function buildGrid(map: MapData): Float32Array {
  const pts: { x: number; y: number; h: number }[] = map.pois.map((p) => ({
    x: p.nx,
    y: p.ny,
    h: Math.max(-4, Math.min(150, p.z)),
  }));
  // Map-Rand = Meer
  const K = 7;
  for (let i = 0; i <= K; i++) {
    const t = i / K;
    pts.push({ x: -0.04, y: t, h: 0 }, { x: 1.04, y: t, h: 0 }, { x: t, y: -0.04, h: 0 }, { x: t, y: 1.04, h: 0 });
  }

  const g = new Float32Array(GRID * GRID);
  const P2 = 1.6;
  for (let gy = 0; gy < GRID; gy++) {
    const ny = gy / (GRID - 1);
    for (let gx = 0; gx < GRID; gx++) {
      const nx = gx / (GRID - 1);
      let wSum = 0;
      let hSum = 0;
      for (let i = 0; i < pts.length; i++) {
        const dx = nx - pts[i].x;
        const dy = ny - pts[i].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 2.5e-6) {
          wSum = 1;
          hSum = pts[i].h;
          break;
        }
        const w = 1 / Math.pow(d2 + 0.00035, P2 * 0.5 * 2); // ~1/d^P2
        wSum += w;
        hSum += w * pts[i].h;
      }
      g[gy * GRID + gx] = hSum / wSum;
    }
  }
  return g;
}

function sampleGrid(g: Float32Array, nx: number, ny: number): number {
  const x = Math.min(0.99999, Math.max(0, nx)) * (GRID - 1);
  const y = Math.min(0.99999, Math.max(0, ny)) * (GRID - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * GRID + x0;
  const a = g[i];
  const b = g[i + 1];
  const c = g[i + GRID];
  const d = g[i + GRID + 1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Remote-Heightmap laden und per Least-Squares auf POI-Höhen kalibrieren */
async function loadRemote(map: MapData): Promise<{ grid: Float32Array; r2: number } | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = API.HEIGHTMAP_RAW;
  });
  if (!loaded || !img.width) return null;

  const S = GRID;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const lum = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) lum[i] = data[i * 4] / 255;

  // Fit: h_poi ≈ a · lum + b
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const n = map.pois.length;
  const used: { l: number; h: number }[] = [];
  for (const p of map.pois) {
    const l = sampleGrid(lum, p.nx, p.ny);
    const h = Math.max(-4, Math.min(150, p.z));
    used.push({ l, h });
    sx += l; sy += h; sxx += l * l; sxy += l * h;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-6) return null;
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  if (a <= 0 || a > 900) return null;

  // Bestimmtheitsmaß R²
  const mean = sy / n;
  let ssRes = 0, ssTot = 0;
  for (const u of used) {
    const pred = a * u.l + b;
    ssRes += (u.h - pred) ** 2;
    ssTot += (u.h - mean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  if (r2 < 0.4) return null;

  const out = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) out[i] = Math.max(-2, a * lum[i] + b);
  return { grid: out, r2 };
}

export function useTerrain(map: MapData | null) {
  const [state, setState] = useState<TerrainState>({
    ready: false,
    grid: null,
    remote: null,
    remoteStatus: 'loading',
    remoteR2: null,
    source: 'poi',
  });
  const built = useRef(false);

  useEffect(() => {
    if (!map || built.current) return;
    built.current = true;
    const grid = buildGrid(map);
    setState((s) => ({ ...s, ready: true, grid }));
    let alive = true;
    loadRemote(map).then((r) => {
      if (!alive) return;
      if (r) {
        // Remote-Heightmap erfolgreich kalibriert → automatisch Blenden
        setState((s) => ({ ...s, remote: r.grid, remoteStatus: 'ok', remoteR2: r.r2, source: 'blend' }));
      } else {
        setState((s) => ({ ...s, remoteStatus: 'fail' }));
      }
    });
    return () => {
      alive = false;
    };
  }, [map]);

  const sample = (nx: number, ny: number): number => {
    const base = state.grid ? sampleGrid(state.grid, nx, ny) : 10;
    const remote = state.remote && state.source !== 'poi' ? sampleGrid(state.remote, nx, ny) : null;
    let h = remote == null ? base : state.source === 'remote' ? remote : base * 0.55 + remote * 0.45;
    if (h > 3) h += reliefNoise(nx, ny) * Math.min(1, (h - 3) / 22);
    return Math.max(0, h);
  };

  return { terrain: state, sample, setSource: (source: TerrainSource) => setState((s) => ({ ...s, source })) };
}
