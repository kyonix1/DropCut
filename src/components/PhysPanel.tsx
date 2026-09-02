import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_PHYS, PHYS_FIELDS, Phys } from '../config';
import type { DropResult } from '../lib/dropcalc';

export default function PhysPanel({
  open,
  onClose,
  phys,
  setPhys,
  calc,
}: {
  open: boolean;
  onClose: () => void;
  phys: Phys;
  setPhys: (p: Phys) => void;
  calc: DropResult | null;
}) {
  const changed = PHYS_FIELDS.some((f) => phys[f.key] !== DEFAULT_PHYS[f.key]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.22 }}
          className="absolute right-16 top-1/2 z-30 w-[236px] -translate-y-1/2 rounded-lg border border-volt/15 bg-abyss/95 p-3"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="num text-[9px] uppercase tracking-[0.2em] text-sage">Physics</span>
            <div className="flex items-center gap-1">
              {changed && (
                <button
                  type="button"
                  onClick={() => setPhys(DEFAULT_PHYS)}
                  title="Standardwerte"
                  className="cursor-pointer rounded p-1 text-sage transition-colors hover:text-volt"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded p-1 text-sage transition-colors hover:text-haze"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {PHYS_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-haze/75">{f.label}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    step={f.step}
                    value={phys[f.key]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) setPhys({ ...phys, [f.key]: v });
                    }}
                    className="num w-[58px] rounded border border-volt/15 bg-deep px-1.5 py-1 text-right text-[11px] text-haze outline-none focus:border-volt/50"
                  />
                  <span className="num w-[26px] text-[9px] text-sage">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>

          {calc && (
            <div className="mt-2.5 flex flex-col gap-1 border-t border-volt/10 pt-2.5">
              <Row k="Distanz" v={`${Math.round(calc.distance)} m`} />
              <Row k="Freefall" v={`${calc.fallTime.toFixed(1)} s`} />
              <Row k="Glide" v={`${calc.glideTime.toFixed(1)} s`} />
              <Row k="Cut" v={`${calc.cutTime.toFixed(1)} s`} />
              <Row
                k="Cut spart"
                v={`${Math.max(0, calc.timeNoCut - calc.totalTime).toFixed(1)} s`}
                accent
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="num text-[9px] uppercase tracking-[0.14em] text-sage">{k}</span>
      <span className={`num text-[11px] ${accent ? 'text-volt' : 'text-haze/85'}`}>{v}</span>
    </div>
  );
}
