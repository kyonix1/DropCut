import { API, WORLD } from '../config';

export interface Poi {
  id: string;
  name: string;
  /** Weltkoordinaten in Metern */
  x: number;
  y: number;
  /** Terrain-Höhe (z) in Metern — aus den POI-Daten der API */
  z: number;
  /** normalisierte Map-Position 0..1 */
  nx: number;
  ny: number;
  /** Haupt-POI (benannter Ort) vs. Landmark */
  major: boolean;
}

export interface MapData {
  images: { blank: string; pois: string };
  pois: Poi[];
}

const toNorm = (cm: number) => (cm + WORLD.HALF_CM) / (2 * WORLD.HALF_CM);

interface ApiPoi {
  id: string;
  name?: string | null;
  location: { x: number; y: number; z?: number };
}

export async function fetchMap(signal?: AbortSignal): Promise<MapData> {
  let res: Response | null = null;
  try {
    res = await fetch(API.MAP_LANG, { signal });
    if (!res.ok) res = null;
  } catch {
    res = null;
  }
  if (!res) {
    res = await fetch(API.MAP, { signal });
    if (!res.ok) throw new Error(`API ${res.status}`);
  }
  const json = await res.json();
  const d = json?.data;
  if (!d?.images?.blank) throw new Error('Unerwartetes API-Format');

  const pois: Poi[] = (d.pois as ApiPoi[])
    .filter((p) => p.name && Number.isFinite(p.location.x))
    .map((p) => ({
      id: p.id,
      name: p.name as string,
      x: p.location.x / 100,
      y: p.location.y / 100,
      z: (p.location.z ?? 0) / 100,
      nx: toNorm(p.location.x),
      ny: toNorm(p.location.y),
      major: p.id.includes('POI.Generic'),
    }))
    .filter((p) => p.nx > 0.01 && p.nx < 0.99 && p.ny > 0.01 && p.ny < 0.99);

  return { images: { blank: d.images.blank, pois: d.images.pois ?? d.images.blank }, pois };
}
