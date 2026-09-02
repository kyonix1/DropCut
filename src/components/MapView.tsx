import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Locate, Minus, Plus } from 'lucide-react';
import { Norm } from '../config';
import { COLORS, MarkColor, Shape, newId } from '../lib/spots';

export type Tool = 'pan' | 'rect' | 'poly' | 'text';

interface Props {
  mapUrl: string | null;
  onImgError: () => void;
  shapes: Shape[];
  editing: boolean;
  tool: Tool;
  color: MarkColor;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (s: Shape) => void;
  onMove: (id: string, dx: number, dy: number, continuing?: boolean) => void;
  onRequestText: (at: Norm) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function MapView(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const fitted = useRef(false);

  const [mouse, setMouse] = useState<Norm | null>(null);
  const [draft, setDraft] = useState<{ a: Norm; b: Norm } | null>(null);
  const [poly, setPoly] = useState<Norm[]>([]);

  const pan = useRef<{ sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const midPan = useRef(false);
  const dragShape = useRef<{ id: string; last: Norm; started: boolean } | null>(null);

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

  // Polygon abbrechen, wenn Werkzeug gewechselt wird
  useEffect(() => {
    setPoly([]);
    setDraft(null);
  }, [p.tool, p.editing]);

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
      const k = Math.min(10, Math.max(0.8, v.k * factor));
      const px = cx - r.left;
      const py = cy - r.top;
      const ratio = k / v.k;
      const nv = { k, tx: px - (px - v.tx) * ratio, ty: py - (py - v.ty) * ratio };
      viewRef.current = nv;
      setView(nv);
    },
    [S]
  );

  const resetView = useCallback(() => {
    if (S === 0) return;
    const nv = { k: 0.98, tx: (size.w - S * 0.98) / 2, ty: (size.h - S * 0.98) / 2 };
    viewRef.current = nv;
    setView(nv);
  }, [S, size]);

  // ── Pointer ───────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    // Mittlere Maustaste: immer nur bewegen, nie markieren
    if (e.button === 1) {
      e.preventDefault();
      midPan.current = true;
      pan.current = { sx: e.clientX, sy: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty, moved: false };
      return;
    }
    if (e.button !== 0) return;

    const n = toNorm(e.clientX, e.clientY);

    if (p.editing && p.tool === 'rect') {
      setDraft({ a: n, b: n });
      return;
    }
    if (p.editing && (p.tool === 'poly' || p.tool === 'text')) return;

    pan.current = { sx: e.clientX, sy: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const n = toNorm(e.clientX, e.clientY);
    setMouse(n);

    if (dragShape.current && !midPan.current) {
      const d = dragShape.current;
      p.onMove(d.id, n.x - d.last.x, n.y - d.last.y, d.started);
      d.last = n;
      d.started = true;
      return;
    }
    if (draft && !midPan.current) {
      setDraft({ a: draft.a, b: n });
      return;
    }
    const pn = pan.current;
    if (pn && e.buttons) {
      const dx = e.clientX - pn.sx;
      const dy = e.clientY - pn.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) pn.moved = true;
      if (pn.moved) {
        const nv = { ...viewRef.current, tx: pn.tx + dx, ty: pn.ty + dy };
        viewRef.current = nv;
        setView(nv);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    // Mittlere Maustaste beendet nur das Bewegen
    if (midPan.current || e.button === 1) {
      midPan.current = false;
      pan.current = null;
      return;
    }
    if (dragShape.current) {
      dragShape.current = null;
      return;
    }

    if (draft) {
      const { a, b } = draft;
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      if (w > 0.002 && h > 0.002) {
        p.onAdd({
          id: newId(),
          type: 'rect',
          color: p.color,
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w,
          h,
        });
      }
      setDraft(null);
      return;
    }

    const n = toNorm(e.clientX, e.clientY);

    if (p.editing && p.tool === 'poly') {
      setPoly((pts) => [...pts, n]);
      return;
    }
    if (p.editing && p.tool === 'text') {
      p.onRequestText(n);
      return;
    }
    if (pan.current && !pan.current.moved) p.onSelect(null);
    pan.current = null;
  };

  const finishPoly = useCallback(() => {
    if (poly.length >= 3) {
      p.onAdd({ id: newId(), type: 'poly', color: p.color, points: poly });
    }
    setPoly([]);
  }, [poly, p]);

  // Tastatur: Polygon abschließen / abbrechen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && poly.length >= 3) finishPoly();
      if (e.key === 'Escape') setPoly([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poly, finishPoly]);

  const startDragShape = (id: string) => (e: React.PointerEvent) => {
    if (!p.editing || p.tool !== 'pan') return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    p.onSelect(id);
    dragShape.current = { id, last: toNorm(e.clientX, e.clientY), started: false };
  };

  const X = (v: number) => v * 1000;
  const cursor = p.editing && p.tool !== 'pan' ? 'crosshair' : 'default';

  // ── Formen rendern ────────────────────────────────────────────
  const rendered = useMemo(
    () =>
      p.shapes.map((s) => {
        const c = COLORS[s.color];
        const sel = s.id === p.selectedId;
        if (s.type === 'rect') {
          return (
            <rect
              key={s.id}
              x={X(s.x)}
              y={X(s.y)}
              width={X(s.w)}
              height={X(s.h)}
              fill={c.fill}
              stroke={sel ? '#ffffff' : c.stroke}
              strokeWidth={sel ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: p.editing ? 'auto' : 'none', cursor: p.editing ? 'move' : 'default' }}
              onPointerDown={startDragShape(s.id)}
            />
          );
        }
        if (s.type === 'poly') {
          return (
            <polygon
              key={s.id}
              points={s.points.map((q) => `${X(q.x)},${X(q.y)}`).join(' ')}
              fill={c.fill}
              stroke={sel ? '#ffffff' : c.stroke}
              strokeWidth={sel ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: p.editing ? 'auto' : 'none', cursor: p.editing ? 'move' : 'default' }}
              onPointerDown={startDragShape(s.id)}
            />
          );
        }
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.shapes, p.selectedId, p.editing, p.tool]
  );

  const texts = p.shapes.filter((s): s is Extract<Shape, { type: 'text' }> => s.type === 'text');

  return (
    <div
      ref={box}
      className="absolute inset-0 touch-none overflow-hidden bg-deep"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setMouse(null)}
      onDoubleClick={() => poly.length >= 3 && finishPoly()}
      onAuxClick={(e) => e.preventDefault()}
      onWheel={(e) => zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0012))}
    >
      <div
        className="absolute origin-top-left"
        style={{ left: view.tx, top: view.ty, width: S * view.k, height: S * view.k }}
      >
        {p.mapUrl ? (
          <img src={p.mapUrl} onError={p.onImgError} className="mapimg h-full w-full" alt="" draggable={false} />
        ) : (
          <div className="h-full w-full bg-deep" />
        )}

        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {rendered}

          {/* Rechteck-Vorschau */}
          {draft && (
            <rect
              x={X(Math.min(draft.a.x, draft.b.x))}
              y={X(Math.min(draft.a.y, draft.b.y))}
              width={X(Math.abs(draft.b.x - draft.a.x))}
              height={X(Math.abs(draft.b.y - draft.a.y))}
              fill={COLORS[p.color].fill}
              stroke={COLORS[p.color].stroke}
              strokeWidth={2}
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Polygon im Bau */}
          {poly.length > 0 && (
            <>
              <polyline
                points={[...poly, ...(mouse ? [mouse] : [])].map((q) => `${X(q.x)},${X(q.y)}`).join(' ')}
                fill={poly.length >= 2 ? COLORS[p.color].fill : 'none'}
                stroke={COLORS[p.color].stroke}
                strokeWidth={2}
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
              />
              {poly.map((q, i) => (
                <circle key={i} cx={X(q.x)} cy={X(q.y)} r={4} fill={COLORS[p.color].stroke} vectorEffect="non-scaling-stroke" />
              ))}
            </>
          )}
        </svg>

        {/* Text-Marker */}
        {texts.map((s) => (
          <div
            key={s.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-1 text-[15px] font-bold"
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              color: COLORS[s.color].text,
              WebkitTextStroke: '3px #000',
              paintOrder: 'stroke fill',
              outline: s.id === p.selectedId ? '1.5px dashed rgba(255,255,255,0.9)' : 'none',
              outlineOffset: '3px',
              pointerEvents: p.editing ? 'auto' : 'none',
              cursor: p.editing && p.tool === 'pan' ? 'move' : 'default',
            }}
            onPointerDown={startDragShape(s.id)}
          >
            {s.text}
          </div>
        ))}
      </div>

      {/* Polygon-Hinweis */}
      {p.editing && p.tool === 'poly' && poly.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md border border-volt/25 bg-abyss/95 px-3 py-2">
          <span className="num text-[10px] uppercase tracking-[0.16em] text-haze/85">
            {poly.length} Punkte · Doppelklick oder Enter zum Abschließen · Esc bricht ab
          </span>
        </div>
      )}

      {/* Zoom */}
      <div
        className="absolute bottom-4 right-4 z-30 flex flex-col gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <ZoomBtn onClick={() => zoomAt(size.w / 2, size.h / 2, 1.4)} label="Zoom in">
          <Plus className="h-4 w-4" />
        </ZoomBtn>
        <ZoomBtn onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.4)} label="Zoom out">
          <Minus className="h-4 w-4" />
        </ZoomBtn>
        <ZoomBtn onClick={resetView} label="Ansicht zurücksetzen">
          <Locate className="h-4 w-4" />
        </ZoomBtn>
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-volt/15 bg-abyss/90 text-haze/80 transition-colors hover:border-volt/50 hover:text-volt"
    >
      {children}
    </button>
  );
}
