import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Norm, Stage } from '../config';
import type { DropResult } from '../lib/dropcalc';

interface Props {
  mapUrl: string | null;
  onImgError: () => void;
  stage: Stage;
  spot: Norm | null;
  routeA: Norm | null;
  routeB: Norm | null;
  calc: DropResult | null;
  onPlace: (p: Norm) => void;
  onDragMarker: (id: 'spot' | 'a' | 'b', p: Norm) => void;
  onReset: () => void;
  onTogglePhys: () => void;
  physOpen: boolean;
}

type DragId = 'spot' | 'a' | 'b' | null;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function MapView(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const [mouse, setMouse] = useState<{ x: number; y: number; n: Norm } | null>(null);
  const dragMarker = useRef<DragId>(null);
  const pan = useRef<{ sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const fitted = useRef(false);

  const S = Math.min(size.w, size.h);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (fitted.current || S === 0) return;
    fitted.current = true;
    const v = { k: 0.98, tx: (size.w - S * 0.98) / 2, ty: (size.h - S * 0.98) / 2 };
    viewRef.current = v;
    setView(v);
  }, [S, size]);

  const toNorm = useCallback(
    (cx: number, cy: number): Norm => {
      const el = box.current!.getBoundingClientRect();
      const v = viewRef.current;
      return {
        x: clamp01((cx - el.left - v.tx) / (S * v.k)),
        y: clamp01((cy - el.top - v.ty) / (S * v.k)),
      };
    },
    [S]
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const el = box.current;
      if (!el || S === 0) return;
      const r = el.getBoundingClientRect();
      const v = viewRef.current;
      const k = Math.min(8, Math.max(0.85, v.k * factor));
      const px = cx - r.left;
      const py = cy - r.top;
      const ratio = k / v.k;
      const nv = { k, tx: px - (px - v.tx) * ratio, ty: py - (py - v.ty) * ratio };
      viewRef.current = nv;
      setView(nv);
    },
    [S]
  );

  const zoomCenter = (f: number) => zoomAt(size.w / 2, size.h / 2, f);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pan.current = { sx: e.clientX, sy: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const n = toNorm(e.clientX, e.clientY);
    const el = box.current!.getBoundingClientRect();
    setMouse({ x: e.clientX - el.left, y: e.clientY - el.top, n });
    if (dragMarker.current) {
      p.onDragMarker(dragMarker.current, n);
      return;
    }
    const pn = pan.current;
    if (pn && e.buttons) {
      const dx = e.clientX - pn.sx;
      const dy = e.clientY - pn.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) pn.moved = true;
      if (pn.moved) {
        const nv = { ...viewRef.current, tx: pn.tx + dx, ty: pn.ty + dy };
        viewRef.current = nv;
        setView(nv);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragMarker.current) {
      dragMarker.current = null;
      return;
    }
    if (pan.current && !pan.current.moved) p.onPlace(toNorm(e.clientX, e.clientY));
    pan.current = null;
  };

  const startDragMarker = (id: Exclude<DragId, null>) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragMarker.current = id;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const P = (n: Norm) => ({ left: `${n.x * 100}%`, top: `${n.y * 100}%` });

  // Marker werden beim Reinzoomen etwas kleiner, bleiben aber gut erkennbar
  const mScale = Math.min(1, Math.max(0.72, Math.pow(1 / view.k, 0.4)));
  const px = (base: number) => `${base * mScale}px`;

  const routes = useMemo(() => {
    if (!p.routeA && !p.spot) return null;
    const X = (n: Norm) => n.x * 1000;
    const Y = (n: Norm) => n.y * 1000;
    const els: React.ReactNode[] = [];

    if (p.routeA && p.routeB) {
      const A = p.routeA;
      const B = p.routeB;
      const exit = p.calc?.exit ?? null;
      // Bus-Route: eine klare, durchgehende Linie mit dezenter dunkler Kontur
      els.push(
        <line key="cas" x1={X(A)} y1={Y(A)} x2={X(B)} y2={Y(B)}
          stroke="rgba(0,0,0,0.55)" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />,
        <line key="route" x1={X(A)} y1={Y(A)} x2={X(B)} y2={Y(B)}
          stroke="#3d9bff" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      );
      if (exit) {
        // gefahrener Abschnitt heller hervorgehoben
        els.push(
          <line key="flown" x1={X(A)} y1={Y(A)} x2={X(exit)} y2={Y(exit)}
            stroke="#bcdcff" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        );
      }
    }

    if (p.calc && p.spot) {
      const exit = p.calc.exit;
      const spot = p.spot;
      const cut = p.calc.cutPoint;
      const deploy = p.calc.hasGlide ? p.calc.deployPoint : cut;
      els.push(
        <line key="fcas" x1={X(exit)} y1={Y(exit)} x2={X(spot)} y2={Y(spot)}
          stroke="rgba(0,0,0,0.55)" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />,
        // Freefall bis zum Deploy
        <line key="fall" x1={X(exit)} y1={Y(exit)} x2={X(deploy)} y2={Y(deploy)}
          stroke="#45ff8f" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />,
        // Gleitphase Deploy → Cut
        <line key="glide" x1={X(deploy)} y1={Y(deploy)} x2={X(cut)} y2={Y(cut)}
          stroke="#b57cff" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />,
        <line key="cut" x1={X(cut)} y1={Y(cut)} x2={X(spot)} y2={Y(spot)}
          stroke="#ffc25e" strokeWidth={3.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      );
    }

    if (p.stage === 'routeB' && p.routeA && mouse) {
      els.push(
        <line key="ghost" x1={X(p.routeA)} y1={Y(p.routeA)} x2={mouse.n.x * 1000} y2={mouse.n.y * 1000}
          stroke="rgba(61,155,255,0.55)" strokeWidth={3} strokeDasharray="12 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      );
    }
    return <>{els}</>;
  }, [p.routeA, p.routeB, p.calc, p.spot, p.stage, mouse]);

  const hint =
    p.stage === 'spot'
      ? 'Spot'
      : p.stage === 'routeA'
        ? 'Route Start'
        : p.stage === 'routeB'
          ? 'Route Ende'
          : 'Neue Route';

  return (
    <div
      ref={box}
      className="absolute inset-0 cursor-none touch-none overflow-hidden bg-deep"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setMouse(null)}
      onWheel={(e) => zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0012))}
    >
      <div className="absolute origin-top-left" style={{ left: view.tx, top: view.ty, width: S * view.k, height: S * view.k }}>
        {p.mapUrl ? (
          <img src={p.mapUrl} onError={p.onImgError} className="mapimg map-tint h-full w-full" alt="" draggable={false} />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                '#04160f repeating-linear-gradient(0deg, transparent 0 39px, rgba(69,255,143,0.05) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, rgba(69,255,143,0.05) 39px 40px)',
            }}
          />
        )}

        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {routes}
        </svg>

        {/* Bus-Route Endpunkte */}
        {p.routeA && <Node pos={P(p.routeA)} size={px(16)} fill="#3d9bff" onDown={startDragMarker('a')} />}
        {p.routeB && <Node pos={P(p.routeB)} size={px(16)} fill="#3d9bff" onDown={startDragMarker('b')} />}

        {/* Jump */}
        {p.calc && <Node pos={P(p.calc.exit)} size={px(18)} fill="#ffffff" ring="#45ff8f" label="Jump" />}

        {/* Deploy — nur wenn es eine echte Gleitphase gibt */}
        {p.calc && p.calc.hasGlide && (
          <Node pos={P(p.calc.deployPoint)} size={px(15)} fill="#b57cff" ring="#000000" label="Deploy" tint="grape" />
        )}

        {/* Cut */}
        {p.calc && <Node pos={P(p.calc.cutPoint)} size={px(15)} fill="#ffc25e" ring="#000000" label="Cut" tint="amber" />}

        {/* Spot: grüner Punkt, beim Zoomen präziser */}
        {p.spot && (
          <div className="absolute z-20" style={P(p.spot)} onPointerDown={startDragMarker('spot')}>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full bg-volt active:cursor-grabbing"
              style={{
                width: px(17),
                height: px(17),
                boxShadow: '0 0 0 2.5px rgba(0,0,0,0.75), 0 0 0 4px rgba(69,255,143,0.28)',
              }}
            />
            {/* Präzisions-Kern beim Reinzoomen */}
            {view.k > 1.6 && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-abyss"
                style={{ width: px(5), height: px(5) }}
              />
            )}
          </div>
        )}
      </div>

      {/* Fadenkreuz */}
      {mouse && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute top-0 h-full w-px bg-volt/12" style={{ left: mouse.x }} />
          <div className="absolute left-0 h-px w-full bg-volt/12" style={{ top: mouse.y }} />
          <div
            className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-volt/40"
            style={{ left: mouse.x, top: mouse.y }}
          />
          <span className="chip absolute -translate-x-1/2" style={{ left: mouse.x, top: mouse.y - 28 }}>
            {hint}
          </span>
        </div>
      )}

      {/* Controls — eigener Layer, löst keine Map-Klicks aus */}
      <div
        className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Btn onClick={() => zoomCenter(1.4)} label="Zoom in">
          <Plus className="h-4 w-4" />
        </Btn>
        <Btn onClick={() => zoomCenter(1 / 1.4)} label="Zoom out">
          <Minus className="h-4 w-4" />
        </Btn>
        <Btn onClick={p.onReset} label="Zurücksetzen" danger>
          <RotateCcw className="h-4 w-4" />
        </Btn>
        <Btn onClick={p.onTogglePhys} label="Physik-Werte" active={p.physOpen}>
          <SlidersHorizontal className="h-4 w-4" />
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  label,
  danger,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-abyss/90 transition-colors ${
        active ? 'border-volt/60 text-volt' : 'border-volt/15 text-haze/80'
      } ${danger ? 'hover:border-redx/60 hover:text-redx' : 'hover:border-volt/50 hover:text-volt'}`}
    >
      {children}
    </button>
  );
}

function Node({
  pos,
  size,
  fill,
  ring,
  label,
  tint,
  onDown,
}: {
  pos: { left: string; top: string };
  size: string;
  fill: string;
  ring?: string;
  label?: string;
  tint?: 'amber' | 'grape';
  onDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <div className="absolute z-10" style={pos} onPointerDown={onDown}>
      <div
        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${onDown ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          width: size,
          height: size,
          background: fill,
          border: `3px solid ${ring ?? 'rgba(0,0,0,0.6)'}`,
        }}
      />
      {label && (
        <span
          className={`num pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.12em] ${
            tint === 'amber'
              ? 'border-amberx/45 bg-abyss/92 text-amberx'
              : tint === 'grape'
                ? 'border-grape/50 bg-abyss/92 text-grape'
                : 'border-volt/35 bg-abyss/92 text-haze'
          }`}
          style={{ top: `calc(${size} * 0.5 + 7px)` }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
