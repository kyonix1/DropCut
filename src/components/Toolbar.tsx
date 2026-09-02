import { AnimatePresence, motion } from 'framer-motion';
import { Check, Hand, Loader2, Pentagon, RotateCcw, Save, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { COLORS, MarkColor } from '../lib/spots';
import type { Tool } from './MapView';

interface Props {
  visible: boolean;
  tool: Tool;
  setTool: (t: Tool) => void;
  color: MarkColor;
  setColor: (c: MarkColor) => void;
  selectedId: string | null;
  onDelete: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  count: number;
}

const TOOLS: { id: Tool; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'pan', icon: Hand, label: 'Bewegen / Auswählen' },
  { id: 'rect', icon: Square, label: 'Rechteck' },
  { id: 'poly', icon: Pentagon, label: 'Polygon' },
  { id: 'text', icon: Type, label: 'Text' },
];

export default function Toolbar(p: Props) {
  return (
    <AnimatePresence>
      {p.visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-volt/15 bg-abyss/95 p-1.5"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Werkzeuge */}
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              onClick={() => p.setTool(t.id)}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors ${
                p.tool === t.id
                  ? 'border-volt/60 bg-volt/10 text-volt'
                  : 'border-transparent text-haze/70 hover:border-volt/25 hover:text-haze'
              }`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}

          <div className="mx-0.5 h-6 w-px bg-volt/15" />

          {/* Farben */}
          {(Object.keys(COLORS) as MarkColor[]).map((c) => (
            <button
              key={c}
              type="button"
              title={COLORS[c].label}
              onClick={() => p.setColor(c)}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors ${
                p.color === c ? 'border-haze/70' : 'border-transparent hover:border-volt/25'
              }`}
            >
              <span
                className="block h-5 w-5 rounded"
                style={{ background: COLORS[c].fill, border: `2px solid ${COLORS[c].stroke}` }}
              />
            </button>
          ))}

          <div className="mx-0.5 h-6 w-px bg-volt/15" />

          {/* Löschen */}
          <button
            type="button"
            title="Auswahl löschen (Entf)"
            onClick={p.onDelete}
            disabled={!p.selectedId}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent text-haze/70 transition-colors hover:border-redx/50 hover:text-redx disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-transparent disabled:hover:text-haze/70"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Rückgängig */}
          <button
            type="button"
            title="Rückgängig (Strg+Z)"
            onClick={p.onUndo}
            disabled={!p.canUndo}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent text-haze/70 transition-colors hover:border-volt/40 hover:text-volt disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-transparent disabled:hover:text-haze/70"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          {/* Reset auf gespeicherten Stand */}
          <button
            type="button"
            title="Alle ungespeicherten Änderungen verwerfen"
            onClick={p.onReset}
            disabled={!p.dirty}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent text-haze/70 transition-colors hover:border-redx/50 hover:text-redx disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-transparent disabled:hover:text-haze/70"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Speichern */}
          <button
            type="button"
            onClick={p.onSave}
            disabled={p.saving}
            className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors ${
              p.dirty
                ? 'border-volt/60 bg-volt/15 text-volt hover:bg-volt/25'
                : 'border-volt/20 text-haze/70 hover:border-volt/40'
            }`}
          >
            {p.saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : p.saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="num text-[10px] uppercase tracking-[0.16em]">
              {p.saving ? 'Speichert' : p.saved ? 'Gespeichert' : 'Speichern'}
            </span>
          </button>

          <span className="num px-1 text-[9px] uppercase tracking-[0.14em] text-sage">{p.count}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
