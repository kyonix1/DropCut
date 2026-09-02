import { Norm, Phys, TERRAIN_CLEAR, lerpNorm, normToM } from '../config';

// ─── Drop-Berechnung ─────────────────────────────────────────────────────────
//
// Phasenmodell (entspricht der tatsächlichen Ingame-Abfolge):
//
//   BUS      73.3 m/s entlang der Route bis zum JUMP-Punkt
//   FREEFALL Skydive nach dem Absprung: 14.5 m/s horizontal, 32 m/s Sinken
//   DEPLOY   Gleiter auf: 17 m/s horizontal, 7 m/s Sinken (nur nötig, wenn die
//            Distanz im reinen Sturzflug nicht erreichbar ist — der Gleiter ist
//            horizontal schneller, kostet aber viel mehr Zeit pro Höhenmeter)
//   CUT      100 m über Terrain würde der Gleiter zwangsweise offen bleiben;
//            der Cut schneidet ihn weg → wieder Freefall mit 32 m/s
//   LANDING  kurz über Boden Gleiter erneut auf (nicht extra ausgewiesen)
//
// Warum "so viel Sturzflug wie möglich"?
//   Zeit pro Höhenmeter:      Freefall 1/32 = 0.031 s   Gleiter 1/7 = 0.143 s
//   Zeit pro Horizontalmeter: Freefall 1/14.5 = 0.069 s Gleiter 1/17 = 0.059 s
//   Der Gleiter spart pro Horizontalmeter nur 0.010 s, kostet aber pro
//   Höhenmeter 0.112 s mehr → Sturzflug maximieren, Gleiter nur zum Strecken
//   der Reichweite. Genau deshalb ist der Cut so stark.

export interface DropResult {
  feasible: boolean;
  tooFar: boolean;
  exit: Norm;
  deployPoint: Norm;
  cutPoint: Norm;
  hasGlide: boolean;
  tOnRoute: number;
  busDist: number;
  busTime: number;
  fallDist: number;
  fallTime: number;
  glideDist: number;
  glideTime: number;
  cutHeight: number;
  cutTime: number;
  dropTime: number;
  totalTime: number;
  exitAlt: number;
  spotTerrain: number;
  distance: number;
  minClearance: number;
  /** Zeit, die dieselbe Route ohne Glider-Cut brauchen würde */
  timeNoCut: number;
}

export type Sampler = (nx: number, ny: number) => number;

interface Legs {
  dFall: number; // horizontale Strecke im Sturzflug
  dGlide: number; // horizontale Strecke am Gleiter
  hExcess: number; // überschüssige Höhe, senkrecht abgebaut
  cutH: number; // Höhe, die nach dem Cut gefallen wird
  dCut: number; // horizontale Strecke während des Cut-Falls
  time: number;
  tooFar: boolean;
}

function solveLegs(H: number, D: number, ph: Phys): Legs {
  const diveRatio = ph.fallV / ph.fallH; // Höhenverlust pro Horizontalmeter
  const glideRatio = ph.glideV / ph.glideH;

  // Unterste Phase: der weggecuttete Bereich wird im Freefall durchfallen
  const cutH = Math.max(0, Math.min(ph.autoDeploy, H));
  const dCut = Math.min(D, ph.fallH * (cutH / ph.fallV));

  const Hu = Math.max(0, H - cutH);
  const Du = Math.max(0, D - dCut);

  // Sturzflug maximieren, Gleiter nur so viel wie nötig
  let dFall = (Hu - glideRatio * Du) / (diveRatio - glideRatio);
  const tooFar = dFall < -0.5;
  dFall = Math.max(0, Math.min(Du, dFall));
  const dGlide = Math.max(0, Du - dFall);

  const hUsed = dFall * diveRatio + dGlide * glideRatio;
  const hExcess = Math.max(0, Hu - hUsed);

  const time =
    dFall / ph.fallH +
    dGlide / ph.glideH +
    hExcess / ph.fallV +
    cutH / ph.fallV;

  return { dFall, dGlide, hExcess, cutH, dCut, time, tooFar };
}

/** Höhe über NN bei horizontaler Strecke d ab dem Absprung */
function altAt(d: number, exitAlt: number, spotH: number, l: Legs, ph: Phys): number {
  const diveRatio = ph.fallV / ph.fallH;
  const glideRatio = ph.glideV / ph.glideH;
  if (d <= l.dFall) return exitAlt - d * diveRatio;
  const afterFall = exitAlt - l.dFall * diveRatio;
  const dU = l.dFall + l.dGlide;
  if (d <= dU) return afterFall - (d - l.dFall) * glideRatio;
  // senkrechter Überschuss-Abbau, danach der Cut-Fall
  return spotH + l.cutH - (d - dU) * diveRatio;
}

interface Candidate {
  t: number;
  p: Norm;
  score: number;
  busDist: number;
  D: number;
  legs: Legs;
  minClear: number;
}

function evaluate(
  t: number,
  a: Norm,
  b: Norm,
  spot: Norm,
  spotH: number,
  ts: Sampler,
  routeLen: number,
  ph: Phys
): Candidate {
  const p = lerpNorm(a, b, t);
  const D = Math.max(1, normToM(p, spot));
  const H = Math.max(1, ph.busAlt - spotH);
  const legs = solveLegs(H, D, ph);

  const N = 22;
  let minClear = Infinity;
  for (let i = 1; i < N; i++) {
    const f = i / N;
    const q = lerpNorm(p, spot, f);
    const clear = altAt(f * D, ph.busAlt, spotH, legs, ph) - ts(q.x, q.y);
    if (clear < minClear) minClear = clear;
  }

  const busDist = routeLen * t;
  let score = busDist / ph.busSpeed + legs.time;
  if (legs.tooFar) score += 600;
  if (minClear < TERRAIN_CLEAR) score += 40 + (TERRAIN_CLEAR - minClear) * 2;

  return { t, p, score, busDist, D, legs, minClear };
}

export function computeDrop(
  spot: Norm,
  routeA: Norm,
  routeB: Norm,
  ts: Sampler,
  ph: Phys
): DropResult {
  const routeLen = Math.max(20, normToM(routeA, routeB));
  const spotH = ts(spot.x, spot.y);

  const SAMPLES = 300;
  let best: Candidate | null = null;
  for (let i = 0; i <= SAMPLES; i++) {
    const c = evaluate(i / SAMPLES, routeA, routeB, spot, spotH, ts, routeLen, ph);
    if (!best || c.score < best.score) best = c;
  }
  let step = 1 / SAMPLES;
  for (let it = 0; it < 16; it++) {
    step *= 0.5;
    for (const dt of [-step, step]) {
      const t = Math.min(1, Math.max(0, best!.t + dt));
      const c = evaluate(t, routeA, routeB, spot, spotH, ts, routeLen, ph);
      if (c.score < best!.score) best = c;
    }
  }

  const { legs, D } = best!;
  const busTime = best!.busDist / ph.busSpeed;
  const fallTime = legs.dFall / ph.fallH + legs.hExcess / ph.fallV;
  const glideTime = legs.dGlide / ph.glideH;
  const cutTime = legs.cutH / ph.fallV;
  const dropTime = fallTime + glideTime + cutTime;

  // Ohne Cut müssten dieselben Meter am Gleiter abgesunken werden
  const timeNoCut = busTime + fallTime + glideTime + legs.cutH / ph.glideV;

  const deployF = D > 0 ? Math.min(1, legs.dFall / D) : 0;
  const cutF = D > 0 ? Math.min(1, (legs.dFall + legs.dGlide) / D) : 0;

  return {
    feasible: !legs.tooFar && best!.minClear >= TERRAIN_CLEAR,
    tooFar: legs.tooFar,
    exit: best!.p,
    deployPoint: lerpNorm(best!.p, spot, deployF),
    cutPoint: lerpNorm(best!.p, spot, cutF),
    hasGlide: legs.dGlide > 20,
    tOnRoute: best!.t,
    busDist: best!.busDist,
    busTime,
    fallDist: legs.dFall,
    fallTime,
    glideDist: legs.dGlide,
    glideTime,
    cutHeight: legs.cutH,
    cutTime,
    dropTime,
    totalTime: busTime + dropTime,
    exitAlt: ph.busAlt,
    spotTerrain: spotH,
    distance: D,
    minClearance: best!.minClear,
    timeNoCut,
  };
}
