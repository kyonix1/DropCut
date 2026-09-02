import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Intro from './components/Intro';
import MapView from './components/MapView';
import PhysPanel from './components/PhysPanel';
import TopBar from './components/TopBar';
import { DEFAULT_PHYS, Norm, Phys, Stage } from './config';
import { fetchMap, type MapData } from './lib/api';
import { computeDrop } from './lib/dropcalc';
import { useTerrain } from './lib/terrain';

export default function App() {
  const [map, setMap] = useState<MapData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [imgBroken, setImgBroken] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);

  const [spot, setSpot] = useState<Norm | null>(null);
  const [routeA, setRouteA] = useState<Norm | null>(null);
  const [routeB, setRouteB] = useState<Norm | null>(null);
  const [phys, setPhys] = useState<Phys>(DEFAULT_PHYS);
  const [physOpen, setPhysOpen] = useState(false);

  const { terrain, sample } = useTerrain(map);
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  const stableSample = useCallback((x: number, y: number) => sampleRef.current(x, y), []);

  useEffect(() => {
    const ac = new AbortController();
    setErr(null);
    fetchMap(ac.signal)
      .then(setMap)
      .catch(() => {
        if (!ac.signal.aborted) setErr('fortnite-api.com nicht erreichbar');
      });
    return () => ac.abort();
  }, [attempt]);

  useEffect(() => {
    if (map && terrain.ready) {
      const t = setTimeout(() => setIntroVisible(false), 600);
      return () => clearTimeout(t);
    }
  }, [map, terrain.ready]);

  const stage: Stage = !spot ? 'spot' : !routeA ? 'routeA' : !routeB ? 'routeB' : 'done';

  const calc = useMemo(
    () =>
      spot && routeA && routeB && terrain.ready
        ? computeDrop(spot, routeA, routeB, stableSample, phys)
        : null,
    [spot, routeA, routeB, terrain.ready, terrain.source, terrain.remote, stableSample, phys]
  );

  // Spot hat Priorität: nach der Kalkulation ändern Klicks nur noch die Bus-Route.
  const onPlace = useCallback(
    (p: Norm) => {
      if (!spot) setSpot(p);
      else if (!routeA) setRouteA(p);
      else if (!routeB) setRouteB(p);
      else {
        setRouteA(p);
        setRouteB(null);
      }
    },
    [spot, routeA, routeB]
  );

  const onDragMarker = useCallback((id: 'spot' | 'a' | 'b', p: Norm) => {
    if (id === 'spot') setSpot(p);
    else if (id === 'a') setRouteA(p);
    else setRouteB(p);
  }, []);

  const reset = useCallback(() => {
    setSpot(null);
    setRouteA(null);
    setRouteB(null);
  }, []);

  const retry = useCallback(() => {
    setIntroVisible(true);
    setMap(null);
    setErr(null);
    setAttempt((a) => a + 1);
  }, []);

  const mapUrl = !map || imgBroken ? null : imgIdx === 0 ? map.images.blank : map.images.pois;

  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss">
      <MapView
        mapUrl={mapUrl}
        onImgError={() => (imgIdx === 0 ? setImgIdx(1) : setImgBroken(true))}
        stage={stage}
        spot={spot}
        routeA={routeA}
        routeB={routeB}
        calc={calc}
        onPlace={onPlace}
        onDragMarker={onDragMarker}
        onReset={reset}
        onTogglePhys={() => setPhysOpen((v) => !v)}
        physOpen={physOpen}
      />

      <PhysPanel
        open={physOpen}
        onClose={() => setPhysOpen(false)}
        phys={phys}
        setPhys={setPhys}
        calc={calc}
      />

      <TopBar />

      {/* einziges Readout: Drop-Zeit */}
      <AnimatePresence>
        {calc && (
          <motion.div
            key="time"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-baseline gap-2 rounded-lg border border-volt/15 bg-abyss/90 px-4 py-2.5"
          >
            <span className="num text-2xl font-semibold text-volt">{calc.dropTime.toFixed(1)}</span>
            <span className="num text-[10px] uppercase tracking-[0.2em] text-sage">s Drop</span>
            {calc.tooFar && (
              <span className="num ml-2 text-[10px] uppercase tracking-[0.16em] text-amberx">zu weit</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Intro show={introVisible} error={err} onRetry={retry} />
    </div>
  );
}
